function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. See .env.example and SETUP.md.`,
    );
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get AUTH_SECRET() {
    return required("AUTH_SECRET");
  },
  get AUTH_URL() {
    return required("AUTH_URL");
  },
  get RESEND_API_KEY() {
    return required("RESEND_API_KEY");
  },
  get EMAIL_FROM() {
    return required("EMAIL_FROM");
  },

  // Inbound reply address. When set, outgoing pitches use it as Reply-To so
  // replies route to /api/webhooks/resend-inbound for automatic reply tracking.
  EMAIL_REPLY_TO: optional("EMAIL_REPLY_TO"),

  ANTHROPIC_API_KEY: optional("ANTHROPIC_API_KEY"),
  NEWS_API_KEY: optional("NEWS_API_KEY"),
  YOUTUBE_API_KEY: optional("YOUTUBE_API_KEY"),
  YOUTUBE_OAUTH_CLIENT_ID: optional("YOUTUBE_OAUTH_CLIENT_ID"),
  YOUTUBE_OAUTH_CLIENT_SECRET: optional("YOUTUBE_OAUTH_CLIENT_SECRET"),
  REDDIT_CLIENT_ID: optional("REDDIT_CLIENT_ID"),
  REDDIT_CLIENT_SECRET: optional("REDDIT_CLIENT_SECRET"),
  REDDIT_USER_AGENT: optional("REDDIT_USER_AGENT"),
  META_APP_ID: optional("META_APP_ID"),
  META_APP_SECRET: optional("META_APP_SECRET"),
  META_WEBHOOK_VERIFY_TOKEN: optional("META_WEBHOOK_VERIFY_TOKEN"),
  INNGEST_EVENT_KEY: optional("INNGEST_EVENT_KEY"),
  INNGEST_SIGNING_KEY: optional("INNGEST_SIGNING_KEY"),
  ONEUP_API_KEY: optional("ONEUP_API_KEY"),
  // Influencer discovery for Instagram/TikTok (paid: Modash / HypeAuditor).
  // When unset, the influencer finder only searches YouTube.
  MODASH_API_KEY: optional("MODASH_API_KEY"),
  // Cheap pay-as-you-go Instagram/TikTok profile data (scrapecreators.com,
  // ~$10 per 5k lookups, credits never expire). Used by the engagement
  // analyzer and tracked-influencer refresh; preferred over Modash when set.
  SCRAPECREATORS_API_KEY: optional("SCRAPECREATORS_API_KEY"),
};
