# Setup Guide

Step-by-step to go from empty repo → working local dev → deployed.

## 1. Local prerequisites

- Node 20+ (you have v22 ✓)
- A Postgres database. Easiest: free Neon project at https://neon.tech
- A Resend account: https://resend.com (free tier = 3k emails/mo)
- A domain you control for sending email (you cannot send press releases from a public ESP without one — Gmail/Outlook recipients will mark you as spam)

## 2. Get the app running

```bash
# install deps (already done)
npm install

# fill in env
cp .env.example .env.local
# then edit .env.local
```

### Required env vars to boot:

| Var | How to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → connection string (pick "pooled connection") |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` locally; your prod URL when deployed |
| `RESEND_API_KEY` | Resend dashboard → API Keys → Create |
| `EMAIL_FROM` | An address on a verified Resend domain, e.g. `press@yourdomain.com` |

### Set up sending domain (Resend)

This is the single biggest deliverability factor. Without it, press releases land in spam.

1. In Resend, **Domains → Add Domain**. Use a *subdomain* like `press.yourdomain.com` so your main domain reputation stays clean.
2. Resend gives you DNS records (SPF/DKIM/DMARC). Add all of them in your DNS host.
3. Wait 5–60 min, then click **Verify** in Resend.
4. Set `EMAIL_FROM` to `noreply@press.yourdomain.com` (or whatever you want).

### Initialize the database

```bash
npm run db:generate    # creates SQL migration files in ./drizzle/
npm run db:migrate     # applies them to your Neon database
```

### Run it

```bash
npm run dev
```

Open http://localhost:3000 → enter your email → check inbox → click magic link → land in dashboard. The first user to sign in automatically becomes the workspace owner.

## 3. Phase-specific setup (do these as you hit each phase)

### Phase 5 — Sentiment

| Var | How to get |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| `NEWS_API_KEY` | https://newsapi.org → free dev key (100 req/day) |
| `YOUTUBE_API_KEY` | Google Cloud Console → APIs & Services → enable "YouTube Data API v3" → create API key |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | https://www.reddit.com/prefs/apps → Create app → type=script. Set `REDDIT_USER_AGENT` to something like `influencer-pr-tracker/0.1 by u/yourusername` |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | https://www.inngest.com → free Cloud account → app keys |

### Phase 6 — Social posting (OneUp)

Social posting is routed through [OneUp](https://www.oneupapp.io). Connect every account you want to post to (IG, FB, Reddit, X, LinkedIn, Pinterest, GBP, Threads, YouTube, TikTok, Snapchat, Bluesky) inside OneUp, then group them into a Category.

| Var | How to get |
|---|---|
| `ONEUP_API_KEY` | https://www.oneupapp.io/api-access → Generate API Key |

File upload via the Upload Media endpoint requires OneUp's **Growth or Business** plan. On Starter, users can still paste public image/video URLs.

### Phase 4b — Reddit DM automation

Uses Reddit credentials from Phase 5. Note: Reddit closed self-service API access in 2026 — new approvals are rare. The DM client (`lib/platforms/reddit.ts`) is kept in the codebase but won't work without an approved Reddit API app.

### Phase 4b/6 — Instagram + Facebook direct posting (optional, superseded by OneUp)

| Var | How to get |
|---|---|
| `META_APP_ID` / `META_APP_SECRET` | https://developers.facebook.com → My Apps → Create App → "Business" → add Instagram Graph API + Facebook Login products |
| `META_WEBHOOK_VERIFY_TOKEN` | Make one up; you'll paste the same value into Meta's webhook config |

You'll need to submit your app for **Meta App Review** to use these features in production. Allow 2–6 weeks. In the meantime, you can use a Business IG account that's added as a tester on the app.

## 4. Deploying to Vercel

```bash
# from project root
npx vercel link
npx vercel --prod
```

Then in Vercel project settings, add every env var from `.env.local`. Update `AUTH_URL` to your `*.vercel.app` (or custom) domain.

If using Neon, enable the Vercel-Neon integration so previews each get their own DB branch.

## 5. Sanity checks

- [ ] `npm run typecheck` is clean
- [ ] Visit `/settings` — every integration shows correct connected/not-set status
- [ ] Magic-link login works for two different email addresses (second one needs an invite from the first)
- [ ] Press release send to your own email lands in inbox, not spam
