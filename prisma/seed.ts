import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type RootSeed = {
  token: string;
  meaning_hy: string[];
  meaning_en: string[];
  symbol: string | null;
  book_page: number;
  _needsTranscription?: boolean;
  _note?: string;
};

type WordSeed = {
  word_hy: string;
  transliteration: string;
  decomposition: string;
  rootTokens: string[];
  suffix: string | null;
  meaning_hy: string;
  meaning_en: string;
  category: string;
  source: string;
  confidence: number;
  status: string;
  slug: string;
};

async function seedRoots() {
  const raw = readFileSync(resolve(process.cwd(), 'data/roots_seed.json'), 'utf-8');
  const data = JSON.parse(raw) as {
    length1: RootSeed[];
    length2: RootSeed[];
    length3: RootSeed[];
  };

  const toInsert: { token: string; length: number; entry: RootSeed }[] = [
    ...data.length1.map((e) => ({ token: e.token, length: 1, entry: e })),
    ...data.length2.map((e) => ({ token: e.token, length: 2, entry: e })),
    ...data.length3.map((e) => ({ token: e.token, length: 3, entry: e }))
  ];

  for (const { token, length, entry } of toInsert) {
    const notesParts: string[] = [];
    if (entry._note) notesParts.push(entry._note);
    if (entry._needsTranscription) notesParts.push('Needs transcription from book pp. 111-113.');
    const notes = notesParts.length ? notesParts.join(' ') : null;

    await prisma.root.upsert({
      where: { token },
      update: {
        length,
        meaningHy: JSON.stringify(entry.meaning_hy),
        meaningEn: JSON.stringify(entry.meaning_en),
        symbol: entry.symbol,
        bookPage: entry.book_page,
        notesEn: notes
      },
      create: {
        token,
        length,
        meaningHy: JSON.stringify(entry.meaning_hy),
        meaningEn: JSON.stringify(entry.meaning_en),
        symbol: entry.symbol,
        bookPage: entry.book_page,
        notesEn: notes
      }
    });
  }

  const total = await prisma.root.count();
  console.log(`[seed] roots inserted/updated: ${total} (length-1=${await prisma.root.count({ where: { length: 1 } })}, length-2=${await prisma.root.count({ where: { length: 2 } })}, length-3=${await prisma.root.count({ where: { length: 3 } })})`);
}

async function seedWords() {
  const raw = readFileSync(resolve(process.cwd(), 'data/words_seed.json'), 'utf-8');
  const data = JSON.parse(raw) as { words: WordSeed[] };

  for (const w of data.words) {
    const rootIds: number[] = [];
    for (const tok of w.rootTokens) {
      const root = await prisma.root.findUnique({ where: { token: tok } });
      if (!root) {
        console.warn(`[seed] word ${w.word_hy}: root token '${tok}' not found; skipping word.`);
        continue;
      }
      rootIds.push(root.id);
    }
    if (rootIds.length !== w.rootTokens.length) continue;

    await prisma.word.upsert({
      where: { slug: w.slug },
      update: {
        wordHy: w.word_hy,
        transliteration: w.transliteration,
        decomposition: w.decomposition,
        rootSequence: JSON.stringify(rootIds),
        suffix: w.suffix,
        meaningHy: w.meaning_hy,
        meaningEn: w.meaning_en,
        category: w.category,
        source: w.source,
        confidence: w.confidence,
        status: w.status
      },
      create: {
        wordHy: w.word_hy,
        transliteration: w.transliteration,
        decomposition: w.decomposition,
        rootSequence: JSON.stringify(rootIds),
        suffix: w.suffix,
        meaningHy: w.meaning_hy,
        meaningEn: w.meaning_en,
        category: w.category,
        source: w.source,
        confidence: w.confidence,
        status: w.status,
        slug: w.slug
      }
    });
  }
  const total = await prisma.word.count();
  console.log(`[seed] words: ${total} (published=${await prisma.word.count({ where: { status: 'published' } })})`);
}

async function seedEditors() {
  const editors = [
    { email: 'editor@heruni-dict.am', displayName: 'Demo Editor', role: 'editor', password: 'heruni-editor-dev' },
    { email: 'admin@heruni-dict.am', displayName: 'Demo Admin', role: 'admin', password: 'heruni-admin-dev' }
  ];
  for (const e of editors) {
    const passwordHash = await bcrypt.hash(e.password, 10);
    await prisma.editor.upsert({
      where: { email: e.email },
      update: { displayName: e.displayName, role: e.role, passwordHash },
      create: { email: e.email, displayName: e.displayName, role: e.role, passwordHash }
    });
  }
  console.log(`[seed] editors: ${await prisma.editor.count()}`);
}

async function main() {
  console.log('[seed] starting…');
  await seedRoots();
  await seedWords();
  await seedEditors();
  console.log('[seed] done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
