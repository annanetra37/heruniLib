'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Parse a CSV with quoted-field support, same logic as SourceImport.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let i = 0;
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
    } else {
      if (c === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (c === ',') {
        row.push(field);
        field = '';
        i += 1;
        continue;
      }
      if (c === '\r') {
        i += 1;
        continue;
      }
      if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i += 1;
        continue;
      }
      field += c;
      i += 1;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim().length > 0))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim();
      });
      return obj;
    });
}

export default function RootImport() {
  const router = useRouter();
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    try {
      const text = await file.text();
      setPreview(parseCsv(text));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const upload = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const rows = preview.map((r) => ({
        token: (r.token ?? '').trim(),
        length: Number(r.length ?? '0'),
        meaningHy: (r.meaning_hy ?? r.meaningHy ?? '')
          .split(/[;|]/)
          .map((s) => s.trim())
          .filter(Boolean),
        meaningEn: (r.meaning_en ?? r.meaningEn ?? '')
          .split(/[;|]/)
          .map((s) => s.trim())
          .filter(Boolean),
        symbol: r.symbol || null,
        bookPage: Number(r.book_page ?? r.bookPage ?? '111'),
        notesHy: r.notes_hy || null,
        notesEn: r.notes_en || null
      }));
      const r = await fetch('/api/admin/roots/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      setResult(`Upserted ${j.upserted} roots (${j.skipped} skipped).`);
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">CSV bulk import / upsert</h2>
        <a
          href="/api/admin/roots/template"
          className="text-xs font-semibold text-heruni-sun hover:underline"
        >
          Download template →
        </a>
      </div>
      <p className="mt-1 text-xs text-heruni-ink/60">
        Headers: <code>token, length, meaning_hy, meaning_en, symbol, book_page, notes_hy, notes_en</code>.
        Separate multiple glosses with <code>;</code> or <code>|</code>. Existing tokens are updated
        (upsert on token); new tokens are created. Use the template link above for a blank sheet
        with the 86 two-letter + 37 three-letter slots pre-filled (tokens only; editors fill the
        glosses from book pp. 111-113).
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="mt-3 text-xs"
      />
      {filename && (
        <p className="mt-2 text-xs text-heruni-ink/60">
          Loaded: {filename} — {preview?.length ?? 0} rows
        </p>
      )}
      {preview && preview.length > 0 && (
        <div className="mt-3 max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-heruni-amber/10 text-[10px] uppercase">
              <tr>
                <th className="p-1 text-left">Token</th>
                <th className="p-1 text-left">Len</th>
                <th className="p-1 text-left">hy</th>
                <th className="p-1 text-left">en</th>
                <th className="p-1 text-left">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.slice(0, 15).map((r, idx) => (
                <tr key={idx}>
                  <td className="p-1 font-bold" lang="hy">
                    {r.token}
                  </td>
                  <td className="p-1 font-mono">{r.length}</td>
                  <td className="p-1 max-w-xs truncate" lang="hy">
                    {r.meaning_hy}
                  </td>
                  <td className="p-1 max-w-xs truncate">{r.meaning_en}</td>
                  <td className="p-1">{r.book_page}</td>
                </tr>
              ))}
              {preview.length > 15 && (
                <tr>
                  <td colSpan={5} className="p-1 text-center text-[10px] text-heruni-ink/50">
                    …and {preview.length - 15} more rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={upload}
          disabled={!preview || busy}
          className="rounded-full bg-heruni-ink px-4 py-2 text-xs font-semibold text-white hover:bg-heruni-sun disabled:opacity-50"
        >
          {busy ? 'Uploading…' : `Upsert ${preview?.length ?? 0} rows`}
        </button>
        {result && <span className="text-xs text-green-700">{result}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
