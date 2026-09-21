import { pgSchema, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Drizzle schema objects for typed queries. DDL is authoritative in
// `migrations/*.sql` (which also carries RLS); these mirror it for the app layer.

export const platform = pgSchema("platform");
export const control = pgSchema("control");
export const catalog = pgSchema("catalog");
export const tenant = pgSchema("tenant");

export const record = tenant.table("record", {
  tenantId: uuid("tenant_id").notNull(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  id: uuid("id").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
