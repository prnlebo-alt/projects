import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  emailVerifiedAt: text("email_verified_at"),
  passwordChangedAt: text("password_changed_at"),
  // Bumped on sign-out; sessions carrying an older epoch are rejected.
  sessionEpoch: integer("session_epoch").notNull().default(0),
  // Marketing channel slug captured from `?ref=` at sign-up. Sanitized to [a-z0-9_-]{1,40}, never a URL or anything user-identifying.
  source: text("source"),
  createdAt: text("created_at").notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /**
   * The spec's ladder is free / developer / pro / business. "scale" remains in the union only so rows
   * written before the rename still parse during the migration; nothing writes it any more.
   */
  plan: text("plan", { enum: ["free", "developer", "pro", "business", "scale"] }).notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  currentPeriodEnd: text("current_period_end"),
  cancelAt: text("cancel_at"),
  createdAt: text("created_at").notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  /**
   * Last four characters of the key, stored in clear.
   *
   * The prefix alone cannot tell two of a customer's keys apart, which makes "which key is this?"
   * unanswerable at exactly the moment it matters — a leak. Four characters of a 32-byte secret leave
   * it uncrackable while making the key identifiable in a list.
   */
  last4: text("last4"),
  /** "live" or "test". Test keys render watermarked output and are never billed. */
  mode: text("mode", { enum: ["live", "test"] }).notNull().default("live"),
  /** Comma-separated subset of render, usage:read, keys:admin. Empty means render only. */
  scopes: text("scopes").notNull().default("render"),
  /** Renders this key may spend per calendar month, or null for no key-level cap. */
  monthlyBudget: integer("monthly_budget"),
  /** Comma-separated CIDRs. Null means any address. */
  ipAllowlist: text("ip_allowlist"),
  /** Free-text marker for which agent or system holds this key. */
  agentTag: text("agent_tag"),
  expiresAt: text("expires_at"),
  /**
   * Set when a key is rotated. The key keeps working until this moment, so an embed does not break
   * the instant someone presses the button, and stops afterwards without anyone having to remember.
   */
  rotatedAt: text("rotated_at"),
  supersededByKeyId: text("superseded_by_key_id"),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull(),
});

/**
 * HMAC secrets for signed chart URLs. Two may be active for one key at a time.
 *
 * A separate table rather than two columns, because the whole point of the second secret is that
 * rotation does not break embeds already pasted into emails and READMEs — and a scheme that can hold
 * exactly two forever is a scheme that cannot be extended when a third is needed during an incident.
 *
 * `publicId` is the `pk_live_…` that appears in a URL as `kid=`. It is safe to publish: it names which
 * secret to verify against and grants nothing on its own.
 */
export const signingSecrets = sqliteTable("signing_secrets", {
  id: text("id").primaryKey(),
  apiKeyId: text("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  publicId: text("public_id").notNull().unique(),
  /** SHA-256 of the secret. The plaintext is shown once, like the key itself. */
  secretHash: text("secret_hash").notNull(),
  /** Set when rotated; the secret keeps verifying until this moment so existing embeds survive. */
  retiresAt: text("retires_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull(),
});

/**
 * Where credit comes from. Append-only: a grant is a fact about money, and facts are not edited.
 *
 * `paymentEventId` is unique, which is what makes a webhook delivered twice grant credit once. The
 * uniqueness lives in the database rather than in the handler because a handler can be racing itself.
 */
export const creditGrants = sqliteTable("credit_grants", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["plan_cycle", "pack", "free", "goodwill"] }).notNull(),
  renders: integer("renders").notNull(),
  /** Renders already drawn from this grant, so a refund knows how much is left to claw back. */
  consumed: integer("consumed").notNull().default(0),
  expiresAt: text("expires_at"),
  /** Set when a grant is reversed by a refund or a dispute. A reversed grant is never spent from. */
  revokedAt: text("revoked_at"),
  paymentEventId: text("payment_event_id").unique(),
  createdAt: text("created_at").notNull(),
});

/**
 * The spendable total, kept as a column rather than summed from grants on every request.
 *
 * A sum over grants would be the purer design and the wrong one: the reserve has to be a single
 * atomic statement that cannot interleave, and `UPDATE … WHERE remaining >= 1 RETURNING` is that
 * statement. The CHECK constraint is the backstop — if any code path ever tries to spend past zero,
 * the database refuses rather than quietly going negative.
 */
export const balances = sqliteTable("balances", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  remaining: integer("remaining").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

/** Every webhook ever processed, by the provider's own event id. The primary key does the deduping. */
export const processedWebhooks = sqliteTable("processed_webhooks", {
  eventId: text("event_id").primaryKey(),
  provider: text("provider").notNull(),
  processedAt: text("processed_at").notNull(),
});

/**
 * What happened, who did it, and when — kept deliberately outside the cascade.
 *
 * `workspaceId` is plain text with no foreign key, so deleting an account does not erase the record
 * that it existed, bought credit and had keys issued. A financial and security log that disappears
 * with its subject is not a log.
 */
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  subject: text("subject"),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});

export const renders = sqliteTable("renders", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  apiKeyId: text("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  spec: text("spec").notNull(),
  svg: text("svg").notNull(),
  altText: text("alt_text").notNull(),
  warnings: text("warnings").notNull(),
  // Rasterized once on first PNG request, then served from here.
  png: blob("png", { mode: "buffer" }),
  createdAt: text("created_at").notNull(),
});

/**
 * Every unit of credit this service has reserved, charged or given back.
 *
 * Evolved rather than replaced: the five original columns still carry the pre-ledger quota counter,
 * and the new ones carry the ledger. Keeping one table means "usage this month" has one answer
 * instead of two that can disagree.
 *
 * `status` is the whole mechanism. A row is written `reserved` before a render starts and settled to
 * `charged` or `refunded` after it ends, so a crash between the two leaves evidence a sweeper can
 * find rather than a credit silently gone.
 */
export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  quantity: integer("quantity").notNull().default(1),
  /** Which key spent this. Null for the pre-ledger rows and for renders made from a session. */
  keyId: text("key_id"),
  requestId: text("request_id"),
  /**
   * Supplied by the client or derived from (key, body hash, minute). Unique per key, which is what
   * makes a retry after a timeout return the first result instead of charging twice.
   */
  idempotencyKey: text("idempotency_key"),
  /**
   * Who the idempotency key belongs to: the API key when there is one, the workspace otherwise.
   *
   * Scoping to the key alone would leave session-authenticated requests undeduplicated, which is the
   * double-submit the header exists to prevent. Scoping to the workspace alone would make two of a
   * customer's keys sending the same ordinary string ("chart-1") collide and replay each other's
   * results.
   */
  idempotencyScope: text("idempotency_scope"),
  units: integer("units").notNull().default(1),
  status: text("status", { enum: ["reserved", "charged", "refunded"] }).notNull().default("charged"),
  format: text("format"),
  cacheHit: integer("cache_hit", { mode: "boolean" }).notNull().default(false),
  /** The chart this charge produced, so a retry with the same idempotency key returns that chart and no other. */
  renderId: text("render_id"),
  /** Set when the row settles, so the sweeper can find reservations older than its threshold. */
  settledAt: text("settled_at"),
  createdAt: text("created_at").notNull(),
});

/**
 * Product events, for the activation funnel and nothing else.
 *
 * Deliberately not analytics. There is no third party, no identifier that follows anyone between
 * sites, no IP address and no user agent — the privacy page names three subprocessors and adding a
 * fourth silently is exactly the sort of thing it exists to prevent. A row is a workspace, a name and
 * a day, which is all the funnel needs.
 *
 * `detail` holds one short free-text answer from the upgrade survey and nothing else.
 */
export const activationEvents = sqliteTable("activation_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});

export const authTokens = sqliteTable("auth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose", { enum: ["verify-email", "reset-password"] }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});

/**
 * Billing tombstone for a deleted account. Deliberately minimal — a Stripe customer id, the workspace it
 * belonged to and when it went — and holds no personal data. It exists so a subscription that somehow
 * outlives its account can still be found, cancelled and refunded, and so webhook processing can say
 * "this customer deleted their account" instead of logging an unactionable warning forever.
 */
export const deletedCustomers = sqliteTable("deleted_customers", {
  stripeCustomerId: text("stripe_customer_id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  deletedAt: text("deleted_at").notNull(),
});

export const stripeEvents = sqliteTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: text("processed_at").notNull(),
});
