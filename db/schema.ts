import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
