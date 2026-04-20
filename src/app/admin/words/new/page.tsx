import { prisma } from '@/lib/prisma';
import WordEditor from '@/components/admin/WordEditor';

export const dynamic = 'force-dynamic';

export default async function NewWordPage() {
  const [patterns, allWords] = await Promise.all([
    prisma.pattern.findMany({
      select: { id: true, code: true, nameHy: true },
      orderBy: { code: 'asc' }
    }),
    prisma.word.findMany({
      select: { id: true, wordHy: true, slug: true },
      orderBy: { wordHy: 'asc' }
    })
  ]);
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">New word</h1>
      <WordEditor patterns={patterns} allWords={allWords} />
    </div>
  );
}
