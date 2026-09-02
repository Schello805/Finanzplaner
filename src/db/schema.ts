import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const memberKind = pgEnum("member_kind", ["adult", "managed_child"]);
export const accountKind = pgEnum("account_kind", ["personal", "joint", "child"]);
export const visibility = pgEnum("visibility", ["private", "shared"]);
export const aiProvider = pgEnum("ai_provider", ["openai", "gemini"]);
export const importStatus = pgEnum("import_status", ["pending", "review", "completed", "failed"]);
export const transactionDirection = pgEnum("transaction_direction", ["income", "expense"]);
export const recurrenceStatus = pgEnum("recurrence_status", ["suggested", "confirmed", "dismissed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").default("Europe/Berlin").notNull(),
  currency: text("currency").default("EUR").notNull(),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  totpSecretEncrypted: text("totp_secret_encrypted"),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [uniqueIndex("users_username_unique").on(sql`lower(${t.username})`)]);

export const householdMembers = pgTable("household_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  kind: memberKind("kind").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("member_user_household_unique").on(t.householdId, t.userId)]);

export const guardians = pgTable("guardians", {
  childMemberId: uuid("child_member_id").references(() => householdMembers.id, { onDelete: "cascade" }).notNull(),
  guardianMemberId: uuid("guardian_member_id").references(() => householdMembers.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("guardian_child_unique").on(t.childMemberId, t.guardianMemberId)]);

export const householdInvitations = pgTable("household_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull(),
  email: text("email"),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("invitation_token_unique").on(t.tokenHash)]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  ownerMemberId: uuid("owner_member_id").references(() => householdMembers.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  kind: accountKind("kind").notNull(),
  ibanEncrypted: text("iban_encrypted"),
  ibanFingerprint: text("iban_fingerprint"),
  ibanLast4: text("iban_last4"),
  currency: text("currency").default("EUR").notNull(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }),
  openingBalanceDate: date("opening_balance_date"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const accountShares = pgTable("account_shares", {
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  memberId: uuid("member_id").references(() => householdMembers.id, { onDelete: "cascade" }).notNull(),
  visibility: visibility("visibility").default("shared").notNull(),
  grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("account_share_unique").on(t.accountId, t.memberId)]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  isIncome: boolean("is_income").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  ...timestamps,
});

export const importTemplates = pgTable("import_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bankName: text("bank_name").notNull(),
  version: integer("version").default(1).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  builtin: boolean("builtin").default(false).notNull(),
  config: jsonb("config").$type<ImportTemplateConfig>().notNull(),
  testedAt: timestamp("tested_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const imports = pgTable("imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  templateId: uuid("template_id").references(() => importTemplates.id, { onDelete: "restrict" }).notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  fileFingerprint: text("file_fingerprint").notNull(),
  originalFilename: text("original_filename").notNull(),
  status: importStatus("status").default("pending").notNull(),
  importedCount: integer("imported_count").default(0).notNull(),
  duplicateCount: integer("duplicate_count").default(0).notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
  errorSummary: text("error_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("imports_file_account_unique").on(t.accountId, t.fileFingerprint)]);

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  importId: uuid("import_id").references(() => imports.id, { onDelete: "restrict" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  bookedOn: date("booked_on").notNull(),
  valuedOn: date("valued_on"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("EUR").notNull(),
  direction: transactionDirection("direction").notNull(),
  bookingType: text("booking_type"),
  counterparty: text("counterparty"),
  counterpartyNormalized: text("counterparty_normalized"),
  purpose: text("purpose"),
  bankReference: text("bank_reference"),
  fingerprint: text("fingerprint").notNull(),
  note: text("note"),
  tags: text("tags").array().default(sql`'{}'::text[]`).notNull(),
  excludedFromAnalysis: boolean("excluded_from_analysis").default(false).notNull(),
  isTransfer: boolean("is_transfer").default(false).notNull(),
  transferPeerId: uuid("transfer_peer_id"),
  duplicateOfId: uuid("duplicate_of_id"),
  categorizationConfidence: numeric("categorization_confidence", { precision: 4, scale: 3 }),
  categorizedBy: text("categorized_by"),
  originalDataEncrypted: text("original_data_encrypted").notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("transactions_account_fingerprint_unique").on(t.accountId, t.fingerprint)]);

export const transactionSplits = pgTable("transaction_splits", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "restrict" }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  note: text("note"),
});

export const categorizationRules = pgTable("categorization_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  ownerMemberId: uuid("owner_member_id").references(() => householdMembers.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  field: text("field").notNull(),
  operator: text("operator").notNull(),
  value: text("value").notNull(),
  shared: boolean("shared").default(false).notNull(),
  priority: integer("priority").default(100).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  ...timestamps,
});

export const recurringTransactions = pgTable("recurring_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  merchantPattern: text("merchant_pattern").notNull(),
  cadenceDays: integer("cadence_days").notNull(),
  expectedAmount: numeric("expected_amount", { precision: 14, scale: 2 }).notNull(),
  status: recurrenceStatus("status").default("suggested").notNull(),
  lastSeenOn: date("last_seen_on").notNull(),
  ...timestamps,
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  valueEncrypted: text("value_encrypted"),
  valueJson: jsonb("value_json"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: aiProvider("provider").notNull(),
  model: text("model").notNull(),
  purpose: text("purpose").notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  estimatedCostEur: numeric("estimated_cost_eur", { precision: 12, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  automaticCategorization: boolean("automatic_categorization").default(false).notNull(),
  automaticInsights: boolean("automatic_insights").default(false).notNull(),
  aiPrivacyMode: text("ai_privacy_mode").default("minimal").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  level: text("level").default("info").notNull(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export interface ImportTemplateConfig {
  delimiter: string;
  encoding: "utf-8" | "utf-8-sig" | "windows-1252" | "iso-8859-1";
  headerRow: number;
  skipEmptyLines: boolean;
  dateFormat: string;
  decimalSeparator: "," | ".";
  columns: Record<string, string>;
  requiredFields: string[];
}

export const householdRelations = relations(households, ({ many }) => ({
  members: many(householdMembers), accounts: many(accounts),
}));
