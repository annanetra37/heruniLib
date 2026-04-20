import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// PATCH /api/admin/ai-drafts/[id]
//
// Approve / edit / reject a pending AiDraft. On approve or edit the chosen
// meaning is copied onto the Word row and Word.aiDraftId is pointed at this
// draft for the audit trail (§3.4 of v2 brief).
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('edit'),
    finalMeaningHy: z.string().min(1),
    finalMeaningEn: z.string().min(1)
  }),
  z.object({ action: z.literal('reject') })
]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const draft = await prisma.aiDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (
    draft.reviewStatus === 'approved' ||
    draft.reviewStatus === 'edited' ||
    draft.reviewStatus === 'rejected'
  ) {
    return NextResponse.json({ error: 'draft already reviewed' }, { status: 400 });
  }

  const actorId = Number((session.user as { id?: string }).id ?? 0) || null;
  const data = parsed.data;

  if (data.action === 'reject') {
    const updated = await prisma.aiDraft.update({
      where: { id },
      data: { reviewStatus: 'rejected', reviewedById: actorId }
    });
    await logAudit({
      actorId,
      action: 'ai_draft.reject',
      entity: 'ai_draft',
      entityId: id,
      diff: { wordId: draft.wordId }
    });
    return NextResponse.json({ id: updated.id, reviewStatus: updated.reviewStatus });
  }

  // Approve or edit → persist chosen text onto the Word and link the draft.
  const finalHy =
    data.action === 'edit' ? data.finalMeaningHy : draft.draftMeaningHy ?? '';
  const finalEn =
    data.action === 'edit' ? data.finalMeaningEn : draft.draftMeaningEn ?? '';
  if (!finalHy.trim() || !finalEn.trim()) {
    return NextResponse.json(
      { error: 'Draft has no meaning text to approve. Use edit to supply one.' },
      { status: 400 }
    );
  }

  const word = await prisma.word.findUnique({ where: { id: draft.wordId } });
  if (!word) return NextResponse.json({ error: 'word not found' }, { status: 404 });

  const reviewStatus = data.action === 'edit' ? 'edited' : 'approved';

  const [updatedDraft, updatedWord] = await prisma.$transaction([
    prisma.aiDraft.update({
      where: { id },
      data: {
        reviewStatus,
        reviewedById: actorId,
        finalMeaningHy: finalHy,
        finalMeaningEn: finalEn
      }
    }),
    prisma.word.update({
      where: { id: draft.wordId },
      data: {
        meaningHy: finalHy,
        meaningEn: finalEn,
        aiDraftId: id,
        // If the model confidently picked a catalogued pattern, set it on
        // the word too — only when word.patternId is currently null, so we
        // don't clobber an editor-set pattern.
        patternId: word.patternId ?? draft.patternId ?? null
      }
    })
  ]);

  await logAudit({
    actorId,
    action: `ai_draft.${reviewStatus}`,
    entity: 'ai_draft',
    entityId: id,
    diff: {
      wordId: draft.wordId,
      before: { meaningHy: word.meaningHy, meaningEn: word.meaningEn },
      after: { meaningHy: finalHy, meaningEn: finalEn }
    }
  });

  revalidatePath(`/hy/words/${updatedWord.slug}`);
  revalidatePath(`/en/words/${updatedWord.slug}`);

  return NextResponse.json({
    id: updatedDraft.id,
    reviewStatus: updatedDraft.reviewStatus,
    wordId: updatedWord.id
  });
}
