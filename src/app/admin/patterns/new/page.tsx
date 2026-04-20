import { prisma } from '@/lib/prisma';
import PatternEditor from '@/components/admin/PatternEditor';

export const dynamic = 'force-dynamic';

export default async function NewPatternPage() {
  const words = await prisma.word.findMany({
    select: { id: true, wordHy: true, slug: true },
    orderBy: { wordHy: 'asc' }
  });
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">New pattern</h1>
      <PatternEditor words={words} />
    </div>
  );
}
