import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DraftReviewClient from '@/components/admin/DraftReviewClient';

export const dynamic = 'force-dynamic';

export default async function DraftDetailPage({
  params: { id }
}: {
  params: { id: string };
}) {
  const draftId = Number(id);
  const draft = await prisma.aiDraft.findUnique({ where: { id: draftId } });
  if (!draft) notFound();

  const [word, pattern] = await Promise.all([
    prisma.word.findUnique({ where: { id: draft.wordId } }),
    draft.patternId
      ? prisma.pattern.findUnique({ where: { id: draft.patternId } })
      : Promise.resolve(null)
  ]);
  if (!word) notFound();

  // Parse the compact audit we stored in promptUsed (see src/lib/claude.ts).
  let auditParsed: {
    version?: string;
    patternCodesInSystem?: string[];
    candidateCodes?: string[];
    classification?: { suffix: string | null; shapeGuess: string; categoryGuess: string | null };
    userPrompt?: string;
  } = {};
  try {
    auditParsed = JSON.parse(draft.promptUsed);
  } catch {
    /* legacy drafts may have a plain-text prompt */
  }

  return (
    <div className="max-w-4xl">
      <nav className="text-sm text-heruni-ink/60">
        <Link href="/admin/ai-drafts" className="hover:underline">
          AI drafts
        </Link>{' '}
        / <span className="font-mono">#{draft.id}</span>
      </nav>

      <h1 className="mt-2 text-3xl font-bold">
        {word.wordHy}{' '}
        <span className="text-sm font-normal text-heruni-ink/60">
          draft #{draft.id} · {draft.reviewStatus}
        </span>
      </h1>

      <section className="mt-6 grid gap-4 md:grid-cols-3 text-sm">
        <Stat label="Pattern" value={pattern ? pattern.code : draft.patternId ? '—' : 'none'} />
        <Stat label="Confidence" value={`${draft.confidence ?? '—'} / 5`} />
        <Stat label="Model" value={draft.model} />
      </section>

      {/* Side by side: current word meaning vs. AI draft. */}
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-heruni-ink/50">
            Current meaning on the word
          </h2>
          <p className="mt-2 text-sm" lang="hy">
            <strong>hy:</strong> {word.meaningHy}
          </p>
          <p className="mt-1 text-sm">
            <strong>en:</strong> {word.meaningEn}
          </p>
        </article>
        <article className="rounded-xl border border-heruni-amber/50 bg-heruni-amber/10 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-heruni-bronze">
            AI draft
          </h2>
          <p className="mt-2 text-sm" lang="hy">
            <strong>hy:</strong> {draft.draftMeaningHy}
          </p>
          <p className="mt-1 text-sm">
            <strong>en:</strong> {draft.draftMeaningEn}
          </p>
          {draft.editorNotes && (
            <p className="mt-3 border-t border-heruni-amber/30 pt-2 text-xs text-heruni-ink/70">
              <strong>Model notes:</strong> {draft.editorNotes}
            </p>
          )}
        </article>
      </section>

      <DraftReviewClient
        draftId={draft.id}
        wordSlug={word.slug}
        initial={{
          reviewStatus: draft.reviewStatus,
          draftMeaningHy: draft.draftMeaningHy ?? '',
          draftMeaningEn: draft.draftMeaningEn ?? '',
          finalMeaningHy: draft.finalMeaningHy ?? draft.draftMeaningHy ?? '',
          finalMeaningEn: draft.finalMeaningEn ?? draft.draftMeaningEn ?? ''
        }}
      />

      <details className="mt-10 rounded-xl border bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
          Audit trail · prompt inputs
        </summary>
        <div className="space-y-4 border-t p-4 text-xs">
          {auditParsed.version && (
            <p>
              <strong>Prompt version:</strong> <code>{auditParsed.version}</code>
            </p>
          )}
          {auditParsed.classification && (
            <p>
              <strong>Classification:</strong>{' '}
              <code>
                suffix={auditParsed.classification.suffix ?? 'null'}, shape=
                {auditParsed.classification.shapeGuess}, category=
                {auditParsed.classification.categoryGuess ?? 'null'}
              </code>
            </p>
          )}
          {auditParsed.candidateCodes && (
            <p>
              <strong>Candidate patterns (ranked):</strong>{' '}
              <code>{auditParsed.candidateCodes.join(', ') || '—'}</code>
            </p>
          )}
          {auditParsed.patternCodesInSystem && (
            <p className="text-heruni-ink/60">
              <strong>Patterns in system prompt:</strong>{' '}
              {auditParsed.patternCodesInSystem.length} ({auditParsed.patternCodesInSystem.join(', ')})
            </p>
          )}
          {auditParsed.userPrompt && (
            <pre className="whitespace-pre-wrap rounded bg-heruni-amber/5 p-3 font-mono text-[11px] text-heruni-ink/70">
              {auditParsed.userPrompt}
            </pre>
          )}
          <details>
            <summary className="cursor-pointer text-heruni-ink/60">Raw model response</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded bg-heruni-amber/5 p-3 font-mono text-[11px]">
              {draft.rawResponse}
            </pre>
          </details>
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-heruni-ink/50">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}
