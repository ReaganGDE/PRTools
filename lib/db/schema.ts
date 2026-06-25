import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
  primaryKey,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(16));

const createdAt = () => timestamp("created_at").defaultNow().notNull();
const updatedAt = () => timestamp("updated_at").defaultNow().notNull();

/* ───────────────────────── Enums ───────────────────────── */

export const platformEnum = pgEnum("platform", [
  "instagram",
  "tiktok",
  "reddit",
  "youtube",
  "facebook",
  "email",
  "x",
  "linkedin",
  "pinterest",
  "gbp",
  "threads",
  "snapchat",
  "bluesky",
  "multi",
]);

export const contactTypeEnum = pgEnum("contact_type", [
  "influencer",
  "outlet",
  "journalist",
]);

export const contactSourceEnum = pgEnum("contact_source", [
  "csv",
  "manual",
  "ig_discover",
  "reddit_discover",
  "youtube_discover",
  "news_discover",
]);

export const templateChannelEnum = pgEnum("template_channel", ["dm", "email"]);

export const campaignTypeEnum = pgEnum("campaign_type", [
  "email",
  "workbench",
  "reddit_auto",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "completed",
  "paused",
]);

export const sendStatusEnum = pgEnum("send_status", [
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "failed",
  "skipped",
]);

export const channelEnum = pgEnum("channel", ["email", "dm"]);

export const dmDirectionEnum = pgEnum("dm_direction", ["inbound", "outbound"]);

export const mentionSourceEnum = pgEnum("mention_source", [
  "news",
  "reddit",
  "youtube",
  "tiktok",
]);

export const sentimentLabelEnum = pgEnum("sentiment_label", [
  "negative",
  "neutral",
  "positive",
]);

export const socialPostStatusEnum = pgEnum("social_post_status", [
  "draft",
  "scheduled",
  "posted",
  "failed",
]);

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const toolAccessEnum = pgEnum("tool_access", [
  "all",
  "pr_only",
  "social_only",
]);

/* ───────────────────── Auth (NextAuth) ───────────────────── */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid(16)),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  workspaceId: text("workspace_id").references(() => workspaces.id, {
    onDelete: "set null",
  }),
  role: userRoleEnum("role").default("member").notNull(),
  toolAccess: toolAccessEnum("tool_access").default("all").notNull(),
  isOnboarding: boolean("is_onboarding").default(false).notNull(),
  createdAt: createdAt(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ─────────────────── Workspaces & invites ─────────────────── */

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  airtableToken: text("airtable_token"),
  airtableBaseId: text("airtable_base_id"),
  followUpDays: integer("follow_up_days").default(4).notNull(),
  createdAt: createdAt(),
});

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: userRoleEnum("role").default("member").notNull(),
    invitedBy: text("invited_by").references(() => users.id),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: createdAt(),
  },
  (t) => [index("invites_workspace_idx").on(t.workspaceId)],
);

/* ────────────────────── Brands ────────────────────── */

export const brandTypeEnum = pgEnum("brand_type", [
  "company",
  "streaming",
  "label",
]);

export const brands = pgTable(
  "brands",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: brandTypeEnum("type").default("company").notNull(),
    color: text("color").default("#dc2626").notNull(),
    active: boolean("active").default(true).notNull(),
    airtableTableId: text("airtable_table_id"),
    airtableLastSyncedAt: timestamp("airtable_last_synced_at"),
    createdAt: createdAt(),
  },
  (t) => [index("brands_workspace_idx").on(t.workspaceId)],
);

/* ────────────────────── Movies ────────────────────── */

export const movieStatusEnum = pgEnum("movie_status", [
  "in_production",
  "pre_release",
  "released",
  "archived",
]);

export const movies = pgTable(
  "movies",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brandId: text("brand_id").references(() => brands.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    releaseDate: timestamp("release_date"),
    theatricalDate: timestamp("theatrical_date"),
    tvodDate: timestamp("tvod_date"),
    avodDate: timestamp("avod_date"),
    distributor: text("distributor"),
    studio: text("studio"),
    productionCompany: text("production_company"),
    mpaaRating: text("mpaa_rating"),
    runtime: integer("runtime"),
    language: text("language"),
    territory: text("territory"),
    rights: text("rights"),
    genres: text("genres").array().default([]).notNull(),
    synopsis: text("synopsis"),
    logline: text("logline"),
    tagline: text("tagline"),
    compTitles: text("comp_titles"),
    posterUrl: text("poster_url"),
    posterAirtableUrl: text("poster_airtable_url"),
    trailerUrl: text("trailer_url"),
    trailerPassword: text("trailer_password"),
    screenerUrl: text("screener_url"),
    screenerPassword: text("screener_password"),
    imdbUrl: text("imdb_url"),
    websiteUrl: text("website_url"),
    pressKitUrl: text("press_kit_url"),
    socialMediaUrl: text("social_media_url"),
    director: text("director"),
    writer: text("writer"),
    castList: text("cast_list"),
    producer: text("producer"),
    copyrightLine: text("copyright_line"),
    coverageReportToken: text("coverage_report_token").unique(),
    manageSocials: boolean("manage_socials").default(true).notNull(),
    status: movieStatusEnum("status").default("in_production").notNull(),
    airtableRecordId: text("airtable_record_id"),
    airtableSyncedAt: timestamp("airtable_synced_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("movies_workspace_idx").on(t.workspaceId),
    index("movies_brand_idx").on(t.brandId),
    uniqueIndex("movies_airtable_uq").on(t.workspaceId, t.airtableRecordId),
  ],
);

/* ────────────────── Connected social accounts ────────────────── */

export const socialAccounts = pgTable("social_accounts", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  handle: text("handle").notNull(),
  oauthToken: text("oauth_token"),
  oauthRefresh: text("oauth_refresh"),
  tokenExpiresAt: timestamp("token_expires_at"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

/* ──────────────── Movie ↔ Contact junction ──────────────── */

export const movieContacts = pgTable(
  "movie_contacts",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    screenerSentAt: timestamp("screener_sent_at"),
    screenerStatus: text("screener_status").notNull().default("not_requested"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("movie_contacts_uniq").on(t.movieId, t.contactId),
    index("movie_contacts_movie_idx").on(t.movieId),
    index("movie_contacts_contact_idx").on(t.contactId),
  ],
);

/* ─────────────────────── Contacts ─────────────────────── */

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: contactTypeEnum("type").default("influencer").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    primaryPlatform: platformEnum("primary_platform"),
    handleInstagram: text("handle_instagram"),
    handleTiktok: text("handle_tiktok"),
    handleReddit: text("handle_reddit"),
    handleYoutube: text("handle_youtube"),
    outlet: text("outlet"),
    beat: text("beat"),
    followerCount: integer("follower_count"),
    tags: text("tags").array().default([]).notNull(),
    notes: text("notes"),
    source: contactSourceEnum("source").default("manual").notNull(),
    unsubscribed: boolean("unsubscribed").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("contacts_workspace_idx").on(t.workspaceId),
    index("contacts_email_idx").on(t.email),
  ],
);

export const contactLists = pgTable("contact_lists", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const contactListMembers = pgTable(
  "contact_list_members",
  {
    listId: text("list_id")
      .notNull()
      .references(() => contactLists.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.contactId] })],
);

/* ─────────────────────── Templates ─────────────────────── */

export const messageTemplates = pgTable("message_templates", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channel: templateChannelEnum("channel").notNull(),
  platform: platformEnum("platform"),
  subject: text("subject"),
  body: text("body").notNull(),
  mergeFields: jsonb("merge_fields")
    .$type<string[]>()
    .default([])
    .notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ─────────────────────── Campaigns ─────────────────────── */

export const campaigns = pgTable("campaigns", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: campaignTypeEnum("type").notNull(),
  platform: platformEnum("platform"),
  templateId: text("template_id").references(() => messageTemplates.id, {
    onDelete: "set null",
  }),
  listId: text("list_id").references(() => contactLists.id, {
    onDelete: "set null",
  }),
  movieId: text("movie_id").references(() => movies.id, {
    onDelete: "set null",
  }),
  status: campaignStatusEnum("status").default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sends = pgTable(
  "sends",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "cascade",
    }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    platform: platformEnum("platform"),
    status: sendStatusEnum("status").default("queued").notNull(),
    renderedBody: text("rendered_body"),
    renderedSubject: text("rendered_subject"),
    sentAt: timestamp("sent_at"),
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),
    repliedAt: timestamp("replied_at"),
    error: text("error"),
    sentByUserId: text("sent_by_user_id").references(() => users.id),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("sends_campaign_idx").on(t.campaignId),
    index("sends_contact_idx").on(t.contactId),
  ],
);

/* ───────────────────── DM threads (inbound) ───────────────────── */

export const dmThreads = pgTable("dm_threads", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  contactId: text("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  platform: platformEnum("platform").notNull(),
  externalThreadId: text("external_thread_id"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: createdAt(),
});

export const dmMessages = pgTable("dm_messages", {
  id: id(),
  threadId: text("thread_id")
    .notNull()
    .references(() => dmThreads.id, { onDelete: "cascade" }),
  direction: dmDirectionEnum("direction").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  externalId: text("external_id"),
});

/* ────────────────────── Sentiment ────────────────────── */

export const keywords = pgTable("keywords", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: createdAt(),
});

export const mentions = pgTable(
  "mentions",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: mentionSourceEnum("source").notNull(),
    url: text("url").notNull(),
    urlHash: text("url_hash").notNull(),
    title: text("title"),
    body: text("body"),
    author: text("author"),
    publishedAt: timestamp("published_at"),
    sentimentScore: real("sentiment_score"),
    sentimentLabel: sentimentLabelEnum("sentiment_label"),
    keywordMatched: text("keyword_matched"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("mentions_ws_hash_uq").on(t.workspaceId, t.urlHash),
    index("mentions_published_idx").on(t.publishedAt),
  ],
);

/* ─────────────────────── Social posts ─────────────────────── */

export const socialPosts = pgTable("social_posts", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  brandId: text("brand_id").references(() => brands.id, {
    onDelete: "set null",
  }),
  movieId: text("movie_id").references(() => movies.id, {
    onDelete: "set null",
  }),
  platform: platformEnum("platform").notNull(),
  status: socialPostStatusEnum("status").default("draft").notNull(),
  body: text("body").notNull(),
  title: text("title"),
  mediaUrls: text("media_urls").array().default([]).notNull(),
  mediaKind: text("media_kind"),
  thumbnailUrl: text("thumbnail_url"),
  subreddit: text("subreddit"),
  oneupCategoryId: text("oneup_category_id"),
  oneupSocialNetworkIds:
    jsonb("oneup_social_network_ids").$type<
      { id: string; name: string; type: string }[]
    >(),
  scheduledAt: timestamp("scheduled_at"),
  postedAt: timestamp("posted_at"),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  error: text("error"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: createdAt(),
});

/* ────────────────────── Audit log ────────────────────── */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("audit_user_idx").on(t.userId),
  ],
);

/* ─────────────── Suppression (unsubscribes) ─────────────── */

export const emailSuppressions = pgTable(
  "email_suppressions",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.email] })],
);

/* ─────────────────────── Finder Cache ─────────────────────── */

export const finderCache = pgTable("finder_cache", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  cacheKey: text("cache_key").notNull(),
  results: text("results").notNull(), // JSON string
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("finder_cache_key_idx").on(t.workspaceId, t.cacheKey),
  index("finder_cache_expires_idx").on(t.expiresAt),
]);

/* ─────────────────────── Saved Searches ─────────────────────── */

export const savedSearchTypeEnum = pgEnum("saved_search_type", ["influencer", "pr"]);

export const savedSearches = pgTable("saved_searches", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  type: savedSearchTypeEnum("type").notNull(),
  name: text("name").notNull(),
  query: text("query").notNull(),
  platforms: text("platforms").array().default([]).notNull(),
  createdAt: createdAt(),
}, (t) => [index("saved_searches_workspace_idx").on(t.workspaceId, t.type)]);

/* ─────────────────────── Pitch Templates ─────────────────────── */

export const pitchTemplates = pgTable("pitch_templates", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

/* ─────────────────────── Movie Coverages ─────────────────────── */

export const movieCoverages = pgTable(
  "movie_coverages",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    movieId: text("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    outlet: text("outlet"),
    headline: text("headline"),
    url: text("url"),
    publishedAt: timestamp("published_at"),
    sentiment: sentimentLabelEnum("sentiment"),
    notes: text("notes"),
    addedBy: text("added_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("movie_coverages_movie_idx").on(t.movieId)],
);

/* ────────────────────── Resources ────────────────────── */

export const resourceTypeEnum = pgEnum("resource_type", ["link", "credential", "document"]);

export const resourceGroups = pgTable("resource_groups", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1").notNull(),
  createdAt: createdAt(),
}, (t) => [index("resource_groups_workspace_idx").on(t.workspaceId)]);

export const resourceGroupMembers = pgTable("resource_group_members", {
  groupId: text("group_id").notNull().references(() => resourceGroups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.groupId, t.userId] })]);

export const resources = pgTable("resources", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  type: resourceTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url"),
  username: text("username"),
  password: text("password"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  fileMimeType: text("file_mime_type"),
  externalUrl: text("external_url"),
  isPersonal: boolean("is_personal").default(false).notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("resources_workspace_idx").on(t.workspaceId),
  index("resources_created_by_idx").on(t.createdBy),
]);

export const resourceGroupAssignments = pgTable("resource_group_assignments", {
  resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  groupId: text("group_id").notNull().references(() => resourceGroups.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.resourceId, t.groupId] })]);

export const resourceUserAssignments = pgTable("resource_user_assignments", {
  resourceId: text("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.resourceId, t.userId] })]);

/* ────────────────────── Onboarding ────────────────────── */

export const onboardingPaperworkStatusEnum = pgEnum("onboarding_paperwork_status", [
  "pending",
  "submitted",
  "approved",
]);

export const onboardingLearningTypeEnum = pgEnum("onboarding_learning_type", [
  "link",
  "text",
]);

// A required paperwork item assigned to a specific onboardee. Admin can attach
// a blank template (link or uploaded file); the onboardee uploads the completed
// document back, which moves it to "submitted".
export const onboardingPaperwork = pgTable("onboarding_paperwork", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => onboardingPaperworkTemplates.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  templateUrl: text("template_url"),
  templateFileUrl: text("template_file_url"),
  templateFileName: text("template_file_name"),
  submittedFileUrl: text("submitted_file_url"),
  submittedFileName: text("submitted_file_name"),
  submittedFileData: text("submitted_file_data"),
  submittedFileContentType: text("submitted_file_content_type"),
  bringsOnDay1: boolean("brings_on_day1").default(false).notNull(),
  status: onboardingPaperworkStatusEnum("status").default("pending").notNull(),
  submittedAt: timestamp("submitted_at"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("onboarding_paperwork_workspace_idx").on(t.workspaceId),
  index("onboarding_paperwork_user_idx").on(t.userId),
]);

// A standard paperwork template every new hire in the workspace must complete.
// When an onboardee opens the portal, one onboarding_paperwork row is
// instantiated per template (linked via templateId) so they can upload the
// completed copy. Editing/deleting a template does not retroactively change
// already-instantiated rows.
export const onboardingPaperworkTemplates = pgTable("onboarding_paperwork_templates", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  templateUrl: text("template_url"),
  templateFileUrl: text("template_file_url"),
  templateFileName: text("template_file_name"),
  sortOrder: integer("sort_order").default(0).notNull(),
  // When true, the portal shows a "I'll bring this on day one" checkbox as an
  // alternative to uploading. Only enable for forms that legally require
  // physical presentation (e.g. I-9 requires in-person document inspection).
  allowBringOnDay1: boolean("allow_bring_on_day1").default(false).notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("onboarding_paperwork_templates_workspace_idx").on(t.workspaceId)]);

// A learning resource shown to all onboardees in the workspace. Either a link
// out, or inline rich text the admin writes directly.
export const onboardingLearnings = pgTable("onboarding_learnings", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: onboardingLearningTypeEnum("type").default("link").notNull(),
  url: text("url"),
  body: text("body"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("onboarding_learnings_workspace_idx").on(t.workspaceId)]);

// A question submitted by an onboardee from anywhere in the portal. Emailed to
// the workspace owner/admins; emailedAt records the delivery attempt.
export const onboardingQuestions = pgTable("onboarding_questions", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  pageContext: text("page_context"),
  answeredAt: timestamp("answered_at"),
  emailedAt: timestamp("emailed_at"),
  createdAt: createdAt(),
}, (t) => [
  index("onboarding_questions_workspace_idx").on(t.workspaceId),
  index("onboarding_questions_user_idx").on(t.userId),
]);

/* ─────────────────────── Relations ─────────────────────── */

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  users: many(users),
  contacts: many(contacts),
  contactLists: many(contactLists),
  campaigns: many(campaigns),
  keywords: many(keywords),
}));

export const usersRelations = relations(users, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [users.workspaceId],
    references: [workspaces.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [contacts.workspaceId],
    references: [workspaces.id],
  }),
  sends: many(sends),
  listMemberships: many(contactListMembers),
}));

export const contactListsRelations = relations(contactLists, ({ many }) => ({
  members: many(contactListMembers),
}));

export const contactListMembersRelations = relations(
  contactListMembers,
  ({ one }) => ({
    list: one(contactLists, {
      fields: [contactListMembers.listId],
      references: [contactLists.id],
    }),
    contact: one(contacts, {
      fields: [contactListMembers.contactId],
      references: [contacts.id],
    }),
  }),
);

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  template: one(messageTemplates, {
    fields: [campaigns.templateId],
    references: [messageTemplates.id],
  }),
  list: one(contactLists, {
    fields: [campaigns.listId],
    references: [contactLists.id],
  }),
  sends: many(sends),
}));

export const sendsRelations = relations(sends, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [sends.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, {
    fields: [sends.contactId],
    references: [contacts.id],
  }),
}));

export const dmThreadsRelations = relations(dmThreads, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [dmThreads.contactId],
    references: [contacts.id],
  }),
  messages: many(dmMessages),
}));

export const dmMessagesRelations = relations(dmMessages, ({ one }) => ({
  thread: one(dmThreads, {
    fields: [dmMessages.threadId],
    references: [dmThreads.id],
  }),
}));

/* ─────────────────────── Types ─────────────────────── */

export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactList = typeof contactLists.$inferSelect;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Send = typeof sends.$inferSelect;
export type Mention = typeof mentions.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ResourceGroup = typeof resourceGroups.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type OnboardingPaperwork = typeof onboardingPaperwork.$inferSelect;
export type OnboardingPaperworkTemplate = typeof onboardingPaperworkTemplates.$inferSelect;
export type OnboardingLearning = typeof onboardingLearnings.$inferSelect;
export type OnboardingQuestion = typeof onboardingQuestions.$inferSelect;
