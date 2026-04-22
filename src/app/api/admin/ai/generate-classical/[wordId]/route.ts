import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateClassicalDraft, logGenerationCost } from '@/lib/claude';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

// POST /api/admin/ai/generate-classical/[wordId] — v2 §4.1.
// Same contract as /api/admin/ai/generate/[wordId] but runs the classical
// pipeline. Produces an AiDraft row with kind='classical'.

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
    const result = await generateClassicalDraft(wordId);
    const editorId = Number((session.user as { id?: string }).id ?? 0) || null;
    const word = await prisma.word.findUnique({
      where: { id: wordId },
      select: { wordHy: true }
    });
    await logGenerationCost({
      wordHy: word?.wordHy ?? `#${wordId}`,
      kind: 'classical',
      model: process.env.AI_MODEL ?? 'claude-opus-4-7',
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadInputTokens,
      cacheWriteTokens: result.usage.cacheCreationInputTokens,
      editorId
    });

    await logAudit({
      actorId: editorId,
      action: 'ai_draft.generate_classical',
      entity: 'ai_draft',
      entityId: result.aiDraftId,
      diff: {
        wordId,
        promptVersion: result.promptVersion,
        usage: result.usage,
        confidence: result.draft.confidence,
        sources: result.draft.sources
      }
    });
    return NextResponse.json({
      aiDraftId: result.aiDraftId,
      draft: result.draft,
      promptVersion: result.promptVersion,
      usage: result.usage
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
