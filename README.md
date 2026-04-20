# Heruni Dict

An ancient Armenian dictionary built on **Paris Heruni's SSB methodology** (from Chapter 2 of *Հայերը և հնագույն Հայաստանը*). Bilingual (Armenian / English). Next.js 14 + TypeScript + Tailwind + Prisma.

The sprint plan that drove this implementation lives in `Heruni_Dict_Sprint_Plan.docx`. The book itself (`Հայերը և հնագույն Հայաստանը - Պարիս Հերունի.pdf`) is the source of the data model and seed content.

## What ships

| Sprint | Status | Notes |
|---|---|---|
| **1 — Foundation + SSB root table** | shipped | Next.js scaffold, Prisma schema, i18n (hy default), public root browse + detail, seed data. |
| **2 — Word entries + decomposition renderer** | shipped | Seed words from book pp. 115–119, dotted-pill renderer, word list + detail pages, "words containing root" on root detail. |
| **3 — Admin CMS** | shipped | NextAuth credentials login, dashboard, roots edit, words CRUD with **Propose split** helper, submissions queue, audit log, editor handbook at `/admin/help`. |
| **4 — Public lookup + search** | shipped | Homepage search, `/api/search`, on-the-fly `/api/decompose`, reviewed vs. automatic badges, public submission form with optional Turnstile. |
| **5 — Polish** | partial | Armenian-aware typography, colour palette, SEO metadata + Open Graph per word. Lighthouse audit / Redis cache / 600-word content expansion are editorial & ops work. |
| **6 — Launch docs** | partial | Editor handbook, privacy, terms, credits pages. Backups, legal sign-off, soft-launch comms are ops work. |

## Setup

```bash
npm install
cp .env.example .env           # then edit NEXTAUTH_SECRET
npx prisma db push             # SQLite — creates prisma/dev.db
npm run db:seed                # inserts roots, words, two editor accounts
npm run dev                    # http://localhost:3000
```

Dev-seeded admin accounts:
- `editor@heruni-dict.am` / `heruni-editor-dev`
- `admin@heruni-dict.am` / `heruni-admin-dev`

## Data model (§5 of the brief)

Five tables: `Root`, `Word`, `Submission`, `Editor`, `AuditLog`. See `prisma/schema.prisma`. Array fields (`meaning_hy text[]`, `root_sequence int[]`, `see_also int[]`) are stored as JSON strings in SQLite and accessed through `parseList` / `parseInts` in `src/lib/prisma.ts`. When migrating to Postgres, convert them to native `text[]` / `int[]` and swap those helpers for pass-throughs.

## Editorial TODO: finish the root table

The brief provides the exact glosses for four roots (ա, ձ, ար, իկա) in §3 and §7. The remaining **158 entries must be transcribed from the book's Appendix 10 (pp. 111–113)** through the admin CMS. The seed currently ships:

- All 39 modern Armenian letters as length-1 stubs (single-letter entries are marked `_needsTranscription: true` where the book gloss has not been verified).
- Length-2 and length-3 entries that appear in the example words (`ար`, `այր`, `ան`, `ասպ`, `պետ`, `ատ`, `ոմ`, `իկա`) with editorial best-effort glosses.
- Empty headroom for the remaining ~79 length-2 and ~36 length-3 entries — editors add them from `/admin/roots/new`. *(Schema is ready; a "new root" admin page is v1.1 since roots are fixed by theory — add a migration that injects them if you want to restrict to admin-only.)*

Every stubbed entry carries a `Needs transcription` note visible on the admin page. An editor working from the book can clear them one by one.

## The decomposition algorithm

`src/lib/decompose.ts` is a greedy longest-match parser:

1. Strip a known inflectional suffix (`-ություն`, `-ական`, `-ներ`, …) — returned separately so the UI can render it as a muted pill.
2. Walk the stem left-to-right; at each position try a 3-letter root, then 2-letter, then 1-letter.
3. Collect any unmatched characters as `unmatched`.

Used by the admin **Propose split** button (`/api/admin/propose-decomposition`) and the public **Decompose** page (`/api/decompose`). Automatic results render with a yellow "Automatic" badge and a "Suggest a correction" link.

## Routing

```
/hy                           → home (default locale)
/en                           → English home
/{locale}/roots               → SSB root browser
/{locale}/roots/{token}       → root detail + words containing it
/{locale}/words               → word list
/{locale}/words/{slug}        → word detail with decomposition renderer
/{locale}/decompose?w=…       → on-the-fly decomposer
/{locale}/contribute          → public submission form
/{locale}/methodology         → Heruni's method + disclaimer
/{locale}/credits | /privacy | /terms
/admin                        → CMS (JWT-guarded by middleware)
/admin/roots | /admin/roots/:id
/admin/words | /admin/words/new | /admin/words/:id
/admin/submissions
/admin/help
/api/decompose, /api/search, /api/submissions, /api/auth/*, /api/admin/*
```

## Deploying

- Swap `datasource db` provider to `postgresql`, convert JSON-string columns to native arrays, re-run `prisma migrate`.
- Railway + Cloudflare DNS per the brief §4.
- Set `NEXTAUTH_SECRET` (e.g. `openssl rand -base64 32`) and `NEXTAUTH_URL`.
- For submissions, set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

## A note on Heruni's method

This app presents reconstructions under Paris Heruni's SSB methodology. The theory is **not** part of mainstream academic etymology. Every reconstructed meaning carries a confidence level and cites its source. The footer links to a methodology page that states this plainly — in both languages — per the brief's guiding principle (§2.3).
