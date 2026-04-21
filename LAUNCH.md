# Heruni Dict v2 — Launch Playbook

This is the operational checklist for the v2 launch, per §6.6 of the v2
sprint plan. It is a working document — update it as you execute.

## T-minus schedule

### T-7 days — freeze & soak
- [ ] Feature freeze on `main`. Only blocker bug fixes after this point.
- [ ] Content milestone: 1000 published words confirmed via
      `/admin` dashboard tile.
- [ ] `npm run ai:test -- --all-pending` on staging — spot-check 20
      generations end-to-end.
- [ ] Full pass of `/admin/prompt-health` for both `kind=heruni` and
      `kind=classical` — any pattern with >40% avg edit rate gets its
      examples reworked or its `applies_when` tightened.
- [ ] Classical-etymology dataset scan: every published word should
      have `classicalEtymologyHy` OR an editor note explaining why not.

### T-3 days — pre-flight
- [ ] Run `/api/export/words.json` and `/api/export/words.csv` manually,
      confirm they download and parse. Hand off to the ops person who
      will wire the nightly S3 cron.
- [ ] Validate `/feed.xml` in <https://validator.w3.org/feed/>. It's
      the source Zontik.am will auto-post from.
- [ ] Lighthouse audit pass on `/hy`, `/hy/roots`, `/hy/words/իշխանություն`,
      `/hy/patterns/state_holder`, `/hy/search?q=իշխ` — aim ≥95 SEO,
      ≥90 a11y.
- [ ] Check `/hy/sitemap.xml` lists every published word. Submit to
      Google Search Console.
- [ ] Rotate `NEXTAUTH_SECRET` on production if not done for v2.
- [ ] Confirm `BOOTSTRAP_ADMIN_*` env vars are unset in production
      (editor accounts should already exist).

### T-1 day — comms dry run
- [ ] Draft Digishot blog post. Focus: the method + v2 unlock (pattern
      catalogue + AI inference, editor-in-the-loop). Never oversell the
      scholarship — "alternative etymological theory, not settled
      academic etymology" appears verbatim somewhere.
- [ ] Instagram carousel — 6-8 slides:
  1. ՏԲ = Տառերի կամ Տարրերի Բառարան (cover)
  2. 39 + 86 + 37 = 162 (the theory)
  3. Worked example: իշխանություն → ի·շ·խ·ան + -ություն
  4. Heruni reconstruction (one card)
  5. Side-by-side vs classical etymology (one card)
  6. "Every meaning human-reviewed" (editorial ethos)
  7. Try it live: heruni-dict.am
- [ ] Linguist-community personal outreach list (10 names, not a PR
      blast). Short note each: "we built this, would love your
      feedback, here's the methodology page, here's a test word."

### T-0 — launch day
- [ ] 08:00 AMT — push the v2 branch to production. Watch
      `/api/health` and Railway logs for 10 min.
- [ ] 09:00 — Digishot blog post live.
- [ ] 09:30 — Instagram carousel posted; story shares from team.
- [ ] 10:00 — 10 personal linguist emails sent.
- [ ] 11:00 — First check of `/admin/monitoring`:
  - AI cost on track (< $5 for first morning — mostly cache hits)
  - No zero-result searches for seed-highlighted words
  - Error rate flat
- [ ] 15:00 — Twitter/Mastodon announcement (shorter framing).
- [ ] End of day — post-launch retro note.

### T+1 through T+3 — monitoring window
- Live dashboard: `/admin/monitoring`. Check 3× daily.
- Triage queue for community feedback: <hello@heruni-dict.am>.
- Zero-result searches become the content-gap worklist — editors
  generate drafts on demand from there.
- Any Claude API anomalies: see `src/lib/claude.ts` retry path; SDK
  auto-retries 429/5xx. If cost spike, flip `AI_MODEL=claude-sonnet-4-6`
  on Railway for the bulk-generate paths.

## Rollback plan
- All v2 schema additions are purely additive (nullable columns, new
  tables). To roll back to v1 editorially, set `AI_MODEL=""` to disable
  the generate buttons — no schema change needed.
- If a deploy breaks rendering, redeploy the previous commit. Word
  pages stay cached via `unstable_cache` tags for 15 min; a cache
  flush happens on the next editor save.

## Press / linguist contact list
*(fill in — 10 personal contacts, not a blast list)*

| Name | Affiliation | Channel | Notes |
|---|---|---|---|
| | | | |

## Budgets
- **Anthropic API**: $100 budget for launch week. Caching typically
  keeps us well under; watch the 72h panel on `/admin/monitoring`.
- **Railway**: scale plan is adequate for < 20k hits/day. Alert
  threshold: 5 concurrent request queue.

## Legal / content
- Book excerpts used at citation length — standard fair-use / academic-
  use range. Reach out to Heruni family if we end up reproducing
  >10% of any chapter. Currently no chapter is reproduced at >2%.
- Աճառյան HAB and NHB citations: public domain in Armenia.
- AI disclosure: `/privacy` and `/methodology` both include the
  "every AI draft is editor-reviewed" language. Terms page lists
  `/feed.xml` and `/feed.json` as the authoritative automation
  surfaces (nothing else auto-publishes on our behalf).

---

*Last updated: v2 freeze prep.*
