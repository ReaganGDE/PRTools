# Influencer & PR Tracker

A web app for film/brand teams to:

- **Track** influencers, journalists, and PR outlets in a shared database
- **Reach out at scale** via:
  - Bulk email + press releases (fully automated via Resend)
  - Semi-autonomous DM workbench for Instagram, TikTok, Reddit, YouTube — the app generates personalized messages and you click send (ToS-safe, no automation risk)
  - Reddit DM full automation (free, allowed by ToS)
- **Monitor sentiment** across news, Reddit, and YouTube
- **Cross-post** to your connected social accounts

Built with Next.js 15, Drizzle ORM, Postgres (Neon), NextAuth, and Resend.

## Quick start

See [SETUP.md](./SETUP.md) for full setup. TL;DR:

```bash
cp .env.example .env.local
# fill in DATABASE_URL, AUTH_SECRET, AUTH_URL, RESEND_API_KEY, EMAIL_FROM
npm run db:generate && npm run db:migrate
npm run dev
```

## Roadmap

- [x] **Phase 1** — Foundation (auth, workspaces, base layout)
- [x] **Phase 2** — Contacts (CSV import, manual entry, lists)
- [x] **Phase 3** — Email & press releases (templates, campaigns, tracking)
- [x] **Phase 4** — Outreach Workbench (semi-auto DM helper)
- [x] **Phase 4b** — Reddit full automation *(blocked: Reddit closed self-serve API access; code retained but inactive)*
- [x] **Phase 5** — Sentiment monitoring
- [x] **Phase 6** — Social poster *(powered by [OneUp](https://www.oneupapp.io) — covers IG, FB, Reddit, X, LinkedIn, Pinterest, GBP, Threads, YouTube, TikTok, Snapchat, Bluesky)*
- [x] **Phase 7** — Polish
  - [x] Unified inbox (DMs + email replies)
  - [x] Audit log (workspace activity, admin-only view)
  - [x] Exports (CSV for contacts, sends, mentions)

## Current status

**Live in prod:**
- OneUp integration deployed. `ONEUP_API_KEY` set in Vercel.
- Migration `0003` (OneUp columns + expanded platform enum) applied to Neon.

**Open verification before next session:**
- Confirm migration `0002` (audit_logs table) was applied to Neon — run `SELECT 1 FROM audit_logs LIMIT 1;` in Neon SQL Editor. If it errors, the migration still needs to be applied.
- Smoke-test `/social/new`: pick category → check accounts → upload image/video → post.

**Known limitations of OneUp v1 (post via `/social/new`):**
- File upload uses OneUp's pre-signed S3 (Growth/Business plan only). On Starter plans the "paste public URL" path works as a fallback.
- No Pinterest board picker, no YouTube playlist picker, no GBP event/offer types, no Instagram Stories toggle, no first-comment field, no Facebook/Instagram location tagging.
- Drafts are saved in our DB only, not pushed to OneUp as drafts.
- Title field only surfaces when Reddit / YouTube / Threads is among selected accounts. Subreddit field only when Reddit is selected.

**Skipped env vars (app runs without them):**
- `ANTHROPIC_API_KEY` — sentiment scoring uses a fallback heuristic.
- `META_APP_ID` / `META_APP_SECRET` — direct Meta posting superseded by OneUp.
- `INNGEST_*` — Vercel daily cron is sufficient on current Hobby plan.

**Possible next additions (rough order of value):**
1. Pinterest board picker + YouTube playlist picker on `/social/new`
2. Instagram Stories / Facebook Stories / TikTok music toggles
3. First-comment field for FB, IG, LinkedIn, YT
4. Use OneUp's `isDraftPost=true` so drafts also appear in the OneUp UI
5. Show OneUp post results (their endpoint returns "N Posts Scheduled" but no per-platform IDs — would need their list-scheduled-posts endpoint to backfill `externalId`/`externalUrl`)
