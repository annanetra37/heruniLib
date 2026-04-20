import type { DiffSegment } from '@/lib/diffWords';

export default function DiffRenderer({
  segments,
  side
}: {
  segments: DiffSegment[];
  side: 'draft' | 'final';
}) {
  // The left column hides additions (they didn't exist in the draft), the
  // right column hides removals (they aren't present in the final).
  return (
    <span className="whitespace-pre-wrap">
      {segments.map((seg, idx) => {
        if (seg.type === 'equal') return <span key={idx}>{seg.text}</span>;
        if (side === 'draft' && seg.type === 'removed') {
          return (
            <span key={idx} className="bg-red-100 text-red-800 line-through">
              {seg.text}
            </span>
          );
        }
        if (side === 'final' && seg.type === 'added') {
          return (
            <span key={idx} className="bg-emerald-100 text-emerald-800">
              {seg.text}
            </span>
          );
        }
        return null;
      })}
    </span>
  );
}
