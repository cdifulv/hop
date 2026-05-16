import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const linkLifecycleState = pgEnum("link_lifecycle_state", [
  "active",
  "suspended",
  "tombstoned",
])

export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identityProviderIssuer: text("identity_provider_issuer").notNull(),
    identityProviderSubject: text("identity_provider_subject").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isBootstrapAdmin: boolean("is_bootstrap_admin").notNull().default(false),
    suspended: boolean("suspended").notNull().default(false),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("members_identity_provider_identity_uq").on(
      table.identityProviderIssuer,
      table.identityProviderSubject,
    ),
    index("members_admin_idx").on(table.isAdmin),
    index("members_suspended_idx").on(table.suspended),
  ],
)

export const links = pgTable(
  "links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    slugKey: varchar("slug_key", { length: 64 }).notNull(),
    destination: text("destination").notNull(),
    ownerMemberId: uuid("owner_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lifecycleState: linkLifecycleState("lifecycle_state").notNull().default("active"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    tombstonedAt: timestamp("tombstoned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("links_slug_key_uq").on(table.slugKey),
    index("links_owner_member_id_idx").on(table.ownerMemberId),
    index("links_created_at_idx").on(table.createdAt),
    index("links_expires_at_idx").on(table.expiresAt),
    index("links_lifecycle_state_idx").on(table.lifecycleState),
  ],
)

export const browserSessions = pgTable(
  "browser_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("browser_sessions_token_hash_uq").on(table.tokenHash)],
)

export const browserSessionLinks = pgTable(
  "browser_session_links",
  {
    browserSessionId: uuid("browser_session_id")
      .notNull()
      .references(() => browserSessions.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("browser_session_links_session_link_uq").on(
      table.browserSessionId,
      table.linkId,
    ),
    index("browser_session_links_link_id_idx").on(table.linkId),
  ],
)

export const clickEvents = pgTable(
  "click_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    coarseReferrer: text("coarse_referrer"),
    userAgentFamily: text("user_agent_family"),
  },
  (table) => [
    index("click_events_link_id_idx").on(table.linkId),
    index("click_events_occurred_at_idx").on(table.occurredAt),
  ],
)

export const deploymentConfig = pgTable("deployment_config", {
  key: varchar("key", { length: 32 }).notNull().default("default").primaryKey(),
  appDomain: text("app_domain"),
  shortDomain: text("short_domain"),
  identityProviderActive: boolean("identity_provider_active").notNull().default(false),
  identityProviderIssuer: text("identity_provider_issuer"),
  identityProviderClientId: text("identity_provider_client_id"),
  identityProviderClientSecretRef: text("identity_provider_client_secret_ref"),
  anonymousCreationEnabled: boolean("anonymous_creation_enabled").notNull().default(true),
  clickRetentionDays: integer("click_retention_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
