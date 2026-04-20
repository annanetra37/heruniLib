import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateHeruniDraft } from '@/lib/claude';
import { logAudit } from '@/lib/audit';

// POST /api/admin/ai/generate/[wordId]
//
// Kicks off the full v2 inference pipeline for a single word and writes an
// AiDraft row. Returns the draft payload so the admin UI can render it
// immediately. Intended to be called one word at a time from the word edit
// page, and in a loop from the Batch 6 "generate 100" bulk action.

export async function POST(
  _req: Request,
  { params }: { params: { wordId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const wordId = Number(params.wordId);
  if (!Number.isFinite(wordId) || wordId <= 0) {
    return NextResponse.json({ error: 'invalid word id' }, { status: 400 });
  }

  try {
    const result = await generateHeruniDraft(wordId);

    await logAudit({
      actorId: Number((session.user as { id?: string }).id ?? 0) || null,
      action: 'ai_draft.generate',
      entity: 'ai_draft',
      entityId: result.aiDraftId,
      diff: {
        wordId,
        promptVersion: result.promptVersion,
        usage: result.usage,
        patternCode: result.draft.pattern_code,
        confidence: result.draft.confidence
      }
    });

    return NextResponse.json({
      aiDraftId: result.aiDraftId,
      draft: result.draft,
      promptVersion: result.promptVersion,
      usage: result.usage
    });
  } catch (err) {
    const message = (err as Error).message ?? 'generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
