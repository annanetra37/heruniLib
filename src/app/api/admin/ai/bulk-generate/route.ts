import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateHeruniDraft } from '@/lib/claude';
import { logAudit } from '@/lib/audit';

// POST /api/admin/ai/bulk-generate
// Body: { wordIds: number[] }  (max 100)
//
// Streams NDJSON progress events so the admin UI can render a live progress
// bar (v2 brief §3.6). Events:
//   {"type":"started","total":N}
//   {"type":"result", ok:true,  wordId, index, aiDraftId, patternCode, confidence}
//   {"type":"result", ok:false, wordId, index, error}
//   {"type":"done", generated, failed}

export const dynamic = 'force-dynamic';
export const maxDuration = 900; // up to 15 minutes; beyond that the user should batch

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

      send({ type: 'started', total: wordIds.length });

      let generated = 0;
      let failed = 0;
      let cachedPatternMap: Map<number, string> | null = null;

      for (let i = 0; i < wordIds.length; i += 1) {
        const wordId = wordIds[i];
        try {
          const result = await generateHeruniDraft(wordId);
          // Resolve pattern code lazily once.
          let patternCode = 'none';
          if (result.draft.pattern_code) {
            patternCode = result.draft.pattern_code;
          } else if (cachedPatternMap == null) {
            const patterns = await prisma.pattern.findMany({ select: { id: true, code: true } });
            cachedPatternMap = new Map(patterns.map((p) => [p.id, p.code]));
          }
          send({
            type: 'result',
            ok: true,
            wordId,
            index: i,
            aiDraftId: result.aiDraftId,
            patternCode,
            confidence: result.draft.confidence
          });
          generated += 1;
        } catch (err) {
          const message = (err as Error).message ?? 'unknown error';
          send({ type: 'result', ok: false, wordId, index: i, error: message });
          failed += 1;
        }
      }

      await logAudit({
        actorId,
        action: 'ai_draft.bulk_generate',
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
