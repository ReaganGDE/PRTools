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
- [ ] **Phase 2** — Contacts (CSV import, manual entry, lists)
- [ ] **Phase 3** — Email & press releases (templates, campaigns, tracking)
- [ ] **Phase 4** — Outreach Workbench (semi-auto DM helper)
- [ ] **Phase 4b** — Reddit full automation
- [ ] **Phase 5** — Sentiment monitoring
- [ ] **Phase 6** — Social poster
- [ ] **Phase 7** — Polish (audit log, unified inbox, exports)
