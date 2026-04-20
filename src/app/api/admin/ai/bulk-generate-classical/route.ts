import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { generateClassicalDraft } from '@/lib/claude';
import { logAudit } from '@/lib/audit';

// POST /api/admin/ai/bulk-generate-classical — v2 §4.1 / §4.2.
// Same NDJSON-streamed progress protocol as /bulk-generate. Kind-separate
// endpoint keeps the pipelines independently rate-limitable.

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

const schema = z.object({
  wordIds: z.array(z.number().int().positive()).min(1).max(100)
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.message }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const actorId = Number((session.user as { id?: string }).id ?? 0) || null;
  const wordIds = parsed.data.wordIds;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      send({ type: 'started', total: wordIds.length, kind: 'classical' });
      let generated = 0;
      let failed = 0;

      for (let i = 0; i < wordIds.length; i += 1) {
        const wordId = wordIds[i];
        try {
          const result = await generateClassicalDraft(wordId);
          send({
            type: 'result',
            ok: true,
            wordId,
            index: i,
            aiDraftId: result.aiDraftId,
            patternCode: 'classical',
            confidence: result.draft.confidence
          });
          generated += 1;
        } catch (err) {
          send({
            type: 'result',
            ok: false,
            wordId,
            index: i,
            error: (err as Error).message ?? 'unknown'
          });
          failed += 1;
        }
      }

      await logAudit({
        actorId,
        action: 'ai_draft.bulk_generate_classical',
        entity: 'ai_draft',
        entityId: null,
        diff: { total: wordIds.length, generated, failed, wordIds }
      });

      send({ type: 'done', generated, failed });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
