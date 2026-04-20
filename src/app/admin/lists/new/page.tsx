import { prisma } from '@/lib/prisma';
import WordListEditor from '@/components/admin/WordListEditor';

export const dynamic = 'force-dynamic';

export default async function NewListPage() {
  const allWords = await prisma.word.findMany({
    select: { id: true, wordHy: true, slug: true },
    orderBy: { wordHy: 'asc' }
  });
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">New list</h1>
      <WordListEditor allWords={allWords} />
    </div>
  );
}
