import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const earlyAccess = sqliteTable("early_access", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  buyerInterest: integer("buyer_interest", { mode: "boolean" })
    .notNull()
    .default(false),
  creatorInterest: integer("creator_interest", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  handle: text("handle"),
  displayName: text("display_name"),
  imageUrl: text("image_url"),
  plan: text("plan").notNull().default("free"),
  onboardingState: text("onboarding_state").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("profiles_email_idx").on(table.email), uniqueIndex("profiles_handle_idx").on(table.handle)]);

export const nooks = sqliteTable("nooks", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  name: text("name").notNull(),
  baseSpecies: text("base_species").notNull().default("orbit-v1"),
  workingStyle: text("working_style").notNull().default("calm"),
  status: text("status").notNull().default("ready"),
  memoryPolicy: text("memory_policy").notNull().default("ask"),
  activeAppearanceId: text("active_appearance_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("nooks_owner_idx").on(table.ownerUserId), uniqueIndex("nooks_owner_name_idx").on(table.ownerUserId, table.name)]);

export const nookAppearances = sqliteTable("nook_appearances", {
  id: text("id").primaryKey(),
  nookId: text("nook_id").notNull(),
  rigVersion: text("rig_version").notNull().default("nook-rig@1"),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  faceGlow: text("face_glow").notNull(),
  outfitId: text("outfit_id"),
  accessoryIdsJson: text("accessory_ids_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("nook_appearances_nook_idx").on(table.nookId, table.createdAt)]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  nookId: text("nook_id").notNull(),
  input: text("input").notNull(),
  source: text("source").notNull().default("web"),
  status: text("status").notNull().default("draft"),
  riskClass: integer("risk_class").notNull().default(0),
  planJson: text("plan_json"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("tasks_owner_status_idx").on(table.ownerUserId, table.status, table.createdAt), index("tasks_nook_idx").on(table.nookId, table.createdAt)]);

export const taskEvents = sqliteTable("task_events", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  taskId: text("task_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("task_events_task_idx").on(table.taskId, table.createdAt)]);

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  creatorUserId: text("creator_user_id").notNull(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  version: text("version").notNull(),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  approvalPolicyJson: text("approval_policy_json").notNull().default("{}"),
  priceCents: integer("price_cents").notNull().default(0),
  reviewStatus: text("review_status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("skills_creator_idx").on(table.creatorUserId, table.reviewStatus), uniqueIndex("skills_creator_name_version_idx").on(table.creatorUserId, table.name, table.version)]);

export const nookSkills = sqliteTable("nook_skills", {
  nookId: text("nook_id").notNull(),
  skillId: text("skill_id").notNull(),
  enabled: integer("enabled", { mode:"boolean" }).notNull().default(true),
  installedAt: text("installed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns:[table.nookId, table.skillId] })]);

export const wearables = sqliteTable("wearables", {
  id: text("id").primaryKey(),
  creatorUserId: text("creator_user_id").notNull(),
  name: text("name").notNull(),
  slot: text("slot").notNull(),
  supportedRig: text("supported_rig").notNull().default("nook-rig@1"),
  assetKey: text("asset_key"),
  priceCents: integer("price_cents").notNull().default(0),
  moderationStatus: text("moderation_status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("wearables_creator_idx").on(table.creatorUserId, table.moderationStatus), index("wearables_rig_slot_idx").on(table.supportedRig, table.slot)]);
