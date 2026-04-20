'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type PatternLite = { id: number; code: string; nameHy: string };
type WordLite = { id: number; wordHy: string; slug: string };
type SourceLite = { id: number; bookPage: number; chapter: string | null; excerptHy: string };

type Initial = {
  id: number;
  wordHy: string;
  transliteration: string;
  decomposition: string;
  rootSequence: number[];
  suffix: string;
  meaningHy: string;
  meaningEn: string;
  category: string;
  source: string;
  confidence: number;
  status: string;
  slug: string;

  // v2 fields (all optional)
  classicalEtymologyHy?: string;
  classicalEtymologyEn?: string;
  classicalSourceRef?: string[];
  firstAttestation?: string;
  usagePeriod?: string;
  historicalUsageHy?: string;
  historicalUsageEn?: string;
  culturalNotesHy?: string;
  culturalNotesEn?: string;
  relatedWordIds?: number[];
  heruniBookRefs?: number[];
  patternId?: number | null;
};

const CATEGORIES = [
  'people',
  'animals',
  'astronomy',
  'nature',
  'names',
  'geography',
  'abstract',
  'tools',
  'other'
];

const STATUSES = ['draft', 'review', 'published'];

const USAGE_PERIODS = [
  '',
  'grabar',
  'middle-armenian',
  'ashkharhabar',
  'modern',
  'pan-historic'
];

function Section({
  title,
  subtitle,
  defaultOpen = false,
  children
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border bg-white" {...(defaultOpen ? { open: true } : {})}>
      <summary className="cursor-pointer select-none px-4 py-3">
        <span className="text-sm font-semibold">{title}</span>
        {subtitle && (
          <span className="ml-2 text-xs text-heruni-ink/50">{subtitle}</span>
        )}
      </summary>
      <div className="space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}

export default function WordEditor({
  initial,
  patterns = [],
  allWords = [],
  suggestedSources = []
}: {
  initial?: Initial;
  patterns?: PatternLite[];
  allWords?: WordLite[];
  suggestedSources?: SourceLite[];
}) {
  const router = useRouter();
  const [wordHy, setWordHy] = useState(initial?.wordHy ?? '');
  const [transliteration, setTransliteration] = useState(initial?.transliteration ?? '');
  const [decomposition, setDecomposition] = useState(initial?.decomposition ?? '');
  const [rootSequence, setRootSequence] = useState<number[]>(initial?.rootSequence ?? []);
  const [suffix, setSuffix] = useState(initial?.suffix ?? '');
  const [meaningHy, setMeaningHy] = useState(initial?.meaningHy ?? '');
  const [meaningEn, setMeaningEn] = useState(initial?.meaningEn ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'other');
  const [source, setSource] = useState(initial?.source ?? 'editor');
  const [confidence, setConfidence] = useState(initial?.confidence ?? 2);
  const [status, setStatus] = useState(initial?.status ?? 'draft');
  const [slug, setSlug] = useState(initial?.slug ?? '');

  // v2 fields
  const [classicalEtymologyHy, setClassicalEtymologyHy] = useState(
    initial?.classicalEtymologyHy ?? ''
  );
  const [classicalEtymologyEn, setClassicalEtymologyEn] = useState(
    initial?.classicalEtymologyEn ?? ''
  );
  const [classicalSourceRefRaw, setClassicalSourceRefRaw] = useState(
    (initial?.classicalSourceRef ?? []).join('\n')
  );
  const [firstAttestation, setFirstAttestation] = useState(initial?.firstAttestation ?? '');
  const [usagePeriod, setUsagePeriod] = useState(initial?.usagePeriod ?? '');
  const [historicalUsageHy, setHistoricalUsageHy] = useState(initial?.historicalUsageHy ?? '');
  const [historicalUsageEn, setHistoricalUsageEn] = useState(initial?.historicalUsageEn ?? '');
  const [culturalNotesHy, setCulturalNotesHy] = useState(initial?.culturalNotesHy ?? '');
  const [culturalNotesEn, setCulturalNotesEn] = useState(initial?.culturalNotesEn ?? '');
  const [relatedWordIds, setRelatedWordIds] = useState<number[]>(initial?.relatedWordIds ?? []);
  const [heruniBookRefs, setHeruniBookRefs] = useState<number[]>(initial?.heruniBookRefs ?? []);
  const [patternId, setPatternId] = useState<number | null>(initial?.patternId ?? null);
  const [relatedQuery, setRelatedQuery] = useState('');

  const [saving, setSaving] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiResult, setAiResult] = useState<
    | null
    | {
        aiDraftId: number;
        meaningHy: string;
        meaningEn: string;
        patternCode: string;
        confidence: number;
      }
  >(null);

  const wordsById = useMemo(() => new Map(allWords.map((w) => [w.id, w])), [allWords]);
  const relatedWords = relatedWordIds.map((id) => wordsById.get(id)).filter(Boolean) as WordLite[];
  const relatedSuggestions = useMemo(() => {
    const q = relatedQuery.trim().toLowerCase();
    if (!q) return [];
    return allWords
      .filter(
        (w) =>
          w.id !== initial?.id &&
          !relatedWordIds.includes(w.id) &&
          (w.wordHy.toLowerCase().includes(q) || w.slug.includes(q))
      )
      .slice(0, 6);
  }, [allWords, relatedWordIds, relatedQuery, initial?.id]);

  const propose = async () => {
    if (!wordHy.trim()) return;
    setProposing(true);
    try {
      const r = await fetch(`/api/admin/propose-decomposition?w=${encodeURIComponent(wordHy)}`);
      const data = (await r.json()) as {
        decomposition: string;
        rootSequence: number[];
        suffix: string | null;
        transliteration: string;
        slug: string;
      };
      setDecomposition(data.decomposition);
      setRootSequence(data.rootSequence);
      setSuffix(data.suffix ?? '');
      if (!transliteration) setTransliteration(data.transliteration);
      if (!slug) setSlug(data.slug);
    } finally {
      setProposing(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const classicalSourceRef = classicalSourceRefRaw
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await fetch(initial ? `/api/admin/words/${initial.id}` : '/api/admin/words', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          wordHy,
          transliteration,
          decomposition,
          rootSequence,
          suffix: suffix || null,
          meaningHy,
          meaningEn,
          category,
          source,
          confidence,
          status,
          slug,
          // v2
          classicalEtymologyHy: classicalEtymologyHy || null,
          classicalEtymologyEn: classicalEtymologyEn || null,
          classicalSourceRef,
          firstAttestation: firstAttestation || null,
          usagePeriod: usagePeriod || null,
          historicalUsageHy: historicalUsageHy || null,
          historicalUsageEn: historicalUsageEn || null,
          culturalNotesHy: culturalNotesHy || null,
          culturalNotesEn: culturalNotesEn || null,
          relatedWordIds,
          heruniBookRefs,
          patternId
        })
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? r.statusText);
      }
      const result = (await r.json()) as { id: number };
      router.push(`/admin/words/${result.id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!initial) return;
    if (!confirm('Soft-delete this word?')) return;
    await fetch(`/api/admin/words/${initial.id}`, { method: 'DELETE' });
    router.push('/admin/words');
  };

  const linkSource = (id: number) => {
    if (!heruniBookRefs.includes(id)) setHeruniBookRefs([...heruniBookRefs, id]);
  };
  const unlinkSource = (id: number) => {
    setHeruniBookRefs(heruniBookRefs.filter((x) => x !== id));
  };

  const field = 'mt-1 w-full rounded-lg border border-heruni-ink/20 bg-white px-3 py-2 text-sm';

  return (
    <form onSubmit={save} className="mt-6 space-y-4 text-sm">
      {/* --- Core word fields (always expanded) ------------------------- */}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Word (hy)</span>
          <input
            required
            value={wordHy}
            onChange={(e) => setWordHy(e.target.value.toLowerCase())}
            className={field}
            lang="hy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Transliteration</span>
          <input
            value={transliteration}
            onChange={(e) => setTransliteration(e.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="rounded-xl border bg-heruni-amber/10 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={propose}
            disabled={!wordHy || proposing}
            className="rounded-full bg-heruni-ink px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {proposing ? '…' : 'Propose split'}
          </button>
          <span className="text-xs text-heruni-ink/60">
            Runs greedy 3→2→1 match on the roots table.
          </span>
        </div>
        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Decomposition</span>
          <input
            value={decomposition}
            onChange={(e) => setDecomposition(e.target.value)}
            className={field}
            lang="hy"
            placeholder="ի • շ • խ • ան"
          />
        </label>
        <label className="mt-2 block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Root sequence (ids)
          </span>
          <input
            value={rootSequence.join(', ')}
            onChange={(e) =>
              setRootSequence(
                e.target.value
                  .split(',')
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isFinite(n) && n > 0)
              )
            }
            className={`${field} font-mono text-xs`}
          />
        </label>
        <label className="mt-2 block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Suffix</span>
          <input
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            className={field}
            placeholder="ություն"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Meaning — Heruni reconstruction (Armenian)
        </span>
        <textarea
          value={meaningHy}
          onChange={(e) => setMeaningHy(e.target.value)}
          className={field}
          rows={2}
          lang="hy"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-heruni-ink/60">
          Meaning — Heruni reconstruction (English)
        </span>
        <textarea
          value={meaningEn}
          onChange={(e) => setMeaningEn(e.target.value)}
          className={field}
          rows={2}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Confidence</span>
          <select
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className={field}
          >
            <option value={1}>1 — from book</option>
            <option value={2}>2 — editor certain</option>
            <option value={3}>3 — editor tentative</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Source</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Slug</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={field} />
        </label>
      </div>

      {/* --- v2 sections (collapsed by default) -------------------------- */}
      <Section
        title="Classical etymology"
        subtitle="Աճառյան / mainstream side-by-side column"
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Classical etymology (hy) · markdown supported
          </span>
          <textarea
            value={classicalEtymologyHy}
            onChange={(e) => setClassicalEtymologyHy(e.target.value)}
            className={field}
            rows={4}
            lang="hy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Classical etymology (en) · markdown supported
          </span>
          <textarea
            value={classicalEtymologyEn}
            onChange={(e) => setClassicalEtymologyEn(e.target.value)}
            className={field}
            rows={4}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Source citations (one per line)
          </span>
          <textarea
            value={classicalSourceRefRaw}
            onChange={(e) => setClassicalSourceRefRaw(e.target.value)}
            className={`${field} font-mono text-xs`}
            rows={3}
            placeholder={'Աճառյան HAB vol.II p.243\nNHB vol.I p.857'}
          />
        </label>
      </Section>

      <Section
        title="Historical usage · cultural notes"
        subtitle="when the word appears, how it evolved"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase text-heruni-ink/60">
              First attestation
            </span>
            <input
              value={firstAttestation}
              onChange={(e) => setFirstAttestation(e.target.value)}
              className={field}
              placeholder="5th c., Ագաթանգեղոս"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase text-heruni-ink/60">Usage period</span>
            <select
              value={usagePeriod}
              onChange={(e) => setUsagePeriod(e.target.value)}
              className={field}
            >
              {USAGE_PERIODS.map((p) => (
                <option key={p || 'none'} value={p}>
                  {p || '—'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Historical usage (hy) · markdown
          </span>
          <textarea
            value={historicalUsageHy}
            onChange={(e) => setHistoricalUsageHy(e.target.value)}
            className={field}
            rows={4}
            lang="hy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Historical usage (en) · markdown
          </span>
          <textarea
            value={historicalUsageEn}
            onChange={(e) => setHistoricalUsageEn(e.target.value)}
            className={field}
            rows={4}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Cultural notes (hy) · markdown
          </span>
          <textarea
            value={culturalNotesHy}
            onChange={(e) => setCulturalNotesHy(e.target.value)}
            className={field}
            rows={3}
            lang="hy"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">
            Cultural notes (en) · markdown
          </span>
          <textarea
            value={culturalNotesEn}
            onChange={(e) => setCulturalNotesEn(e.target.value)}
            className={field}
            rows={3}
          />
        </label>
      </Section>

      <Section
        title={`Related words (${relatedWords.length})`}
        subtitle="same-root or derived words"
      >
        <div className="flex flex-wrap gap-2">
          {relatedWords.map((w) => (
            <button
              type="button"
              key={w.id}
              onClick={() => setRelatedWordIds(relatedWordIds.filter((x) => x !== w.id))}
              className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-red-50 hover:border-red-200"
              lang="hy"
              title="Click to remove"
            >
              {w.wordHy} ×
            </button>
          ))}
          {relatedWords.length === 0 && (
            <span className="text-xs text-heruni-ink/60">No related words attached.</span>
          )}
        </div>
        <div className="relative mt-2">
          <input
            value={relatedQuery}
            onChange={(e) => setRelatedQuery(e.target.value)}
            className={field}
            placeholder="Search words to link…"
            lang="hy"
          />
          {relatedSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
              {relatedSuggestions.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRelatedWordIds([...relatedWordIds, w.id]);
                      setRelatedQuery('');
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-heruni-amber/20"
                    lang="hy"
                  >
                    {w.wordHy}{' '}
                    <span className="text-xs text-heruni-ink/50">/{w.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section
        title={`Heruni book refs (${heruniBookRefs.length})`}
        subtitle="linked Source rows"
      >
        <div className="flex flex-wrap gap-2">
          {heruniBookRefs.map((id) => (
            <button
              type="button"
              key={id}
              onClick={() => unlinkSource(id)}
              className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-red-50 hover:border-red-200"
              title="Click to remove"
            >
              source #{id} ×
            </button>
          ))}
          {heruniBookRefs.length === 0 && (
            <span className="text-xs text-heruni-ink/60">
              No sources linked yet. See the suggestion sidebar for candidates.
            </span>
          )}
        </div>
        <p className="text-xs text-heruni-ink/50">
          Source candidates are suggested on the right sidebar (§1.6) — click to attach.
        </p>
      </Section>

      <Section title="Pattern (§3.3)" subtitle="rhetorical template this reconstruction follows">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-heruni-ink/60">Pattern</span>
          <select
            value={patternId ?? ''}
            onChange={(e) => setPatternId(e.target.value ? Number(e.target.value) : null)}
            className={field}
          >
            <option value="">— none —</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.nameHy}
              </option>
            ))}
          </select>
        </label>
      </Section>

      {/* --- Server-rendered source suggestions (passed in from page) --- */}
      {suggestedSources.length > 0 && (
        <div className="rounded-xl border bg-heruni-amber/10 p-3">
          <h3 className="text-xs font-semibold uppercase text-heruni-ink/60">
            Source suggestions (this word is mentioned on these pages)
          </h3>
          <ul className="mt-2 space-y-1">
            {suggestedSources.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 text-xs">
                <div className="flex-1">
                  <span className="font-mono">p. {s.bookPage}</span>
                  {s.chapter && <span className="ml-2 font-mono">§{s.chapter}</span>}
                  <span className="ml-2" lang="hy">
                    {s.excerptHy.slice(0, 120)}
                    {s.excerptHy.length > 120 ? '…' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => linkSource(s.id)}
                  disabled={heruniBookRefs.includes(s.id)}
                  className="rounded-full bg-heruni-ink px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-40"
                >
                  {heruniBookRefs.includes(s.id) ? 'linked' : 'link'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {initial && (
        <div className="rounded-xl border border-heruni-amber/40 bg-heruni-amber/10 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={generatingAi}
              onClick={async () => {
                setGeneratingAi(true);
                setAiResult(null);
                setError(null);
                try {
                  const r = await fetch(`/api/admin/ai/generate/${initial.id}`, {
                    method: 'POST'
                  });
                  const j = await r.json();
                  if (!r.ok) throw new Error(j.error ?? r.statusText);
                  setAiResult({
                    aiDraftId: j.aiDraftId,
                    meaningHy: j.draft.meaning_hy,
                    meaningEn: j.draft.meaning_en,
                    patternCode: j.draft.pattern_code,
                    confidence: j.draft.confidence
                  });
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setGeneratingAi(false);
                }
              }}
              className="rounded-full bg-heruni-ink px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {generatingAi ? 'Generating…' : 'Generate Heruni draft with AI'}
            </button>
            <span className="text-xs text-heruni-ink/60">
              Creates a pending <code>AiDraft</code> you review in the queue.
            </span>
          </div>
          {aiResult && (
            <div className="mt-3 rounded-lg bg-white p-3 text-xs">
              <p className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-heruni-bronze">
                Draft #{aiResult.aiDraftId} · {aiResult.patternCode} · conf {aiResult.confidence}/5
                <a
                  href={`/admin/ai-drafts/${aiResult.aiDraftId}`}
                  className="ml-auto text-heruni-sun hover:underline"
                >
                  Open in queue →
                </a>
              </p>
              <p className="mt-2" lang="hy">
                <strong>hy:</strong> {aiResult.meaningHy}
              </p>
              <p className="mt-1">
                <strong>en:</strong> {aiResult.meaningEn}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMeaningHy(aiResult.meaningHy);
                  setMeaningEn(aiResult.meaningEn);
                }}
                className="mt-2 rounded-full border px-3 py-0.5 text-[10px] hover:bg-heruni-amber/10"
              >
                Load into the meaning fields above (you'll still need to Save)
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-heruni-ink px-5 py-2 font-semibold text-white hover:bg-heruni-sun disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
        {initial && (
          <button
            type="button"
            onClick={del}
            className="rounded-full border border-red-200 px-4 py-2 text-xs text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
