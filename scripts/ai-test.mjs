// Quick-n-dirty CLI for the v2 AI inference pipeline.
//
//   npm run ai:test -- <wordId>
//   npm run ai:test -- --slug=ishkhanutyun
//   npm run ai:test -- --all-pending    (runs the pipeline on every word
//                                        with status="review" or "draft")
//
// Requires DATABASE_URL + ANTHROPIC_API_KEY. Prints the draft and the usage
// row (so you can eyeball cache hit rates over a loop).

import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';
import { generateHeruniDraft } from '../src/lib/claude.ts';

function parseArgs(argv) {
  const out = { wordId: null, slug: null, allPending: false };
  for (const a of argv.slice(2)) {
    if (a === '--all-pending') out.allPending = true;
    else if (a.startsWith('--slug=')) out.slug = a.slice('--slug='.length);
    else if (/^\d+$/.test(a)) out.wordId = Number(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);

  let wordIds = [];
  if (args.allPending) {
    const rows = await prisma.word.findMany({
      where: { status: { in: ['review', 'draft'] } },
      select: { id: true }
    });
    wordIds = rows.map((r) => r.id);
  } else if (args.slug) {
    const w = await prisma.word.findUnique({ where: { slug: args.slug } });
    if (!w) throw new Error(`no word with slug "${args.slug}"`);
    wordIds = [w.id];
  } else if (args.wordId) {
    wordIds = [args.wordId];
  } else {
    console.error('usage: npm run ai:test -- <wordId> | --slug=<slug> | --all-pending');
    process.exit(2);
  }

  for (const id of wordIds) {
    const word = await prisma.word.findUnique({ where: { id } });
    if (!word) {
      console.error(`[skip] word ${id} not found`);
      continue;
    }
    console.log(`\n--- ${word.wordHy} (id=${id}) ---`);
    try {
      const result = await generateHeruniDraft(id);
      console.log(`  pattern:    ${result.draft.pattern_code}`);
      console.log(`  confidence: ${result.draft.confidence}`);
      console.log(`  hy: ${result.draft.meaning_hy}`);
      console.log(`  en: ${result.draft.meaning_en}`);
      if (result.draft.editor_notes) {
        console.log(`  notes: ${result.draft.editor_notes}`);
      }
      console.log(
        `  usage: in=${result.usage.inputTokens} out=${result.usage.outputTokens} cacheRead=${result.usage.cacheReadInputTokens} cacheWrite=${result.usage.cacheCreationInputTokens}`
      );
      console.log(`  aiDraftId: ${result.aiDraftId}`);
    } catch (err) {
      console.error(`  [fail] ${err.message}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
