import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const contactSubmissionsTable = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  companyName: text("company_name").notNull(),
  country: text("country").notNull(),
  interest: text("interest").notNull(),
  message: text("message").notNull(),
  plan: text("plan"),
  billingCycle: text("billing_cycle"),
  useCase: text("use_case"),
  requestKey: text("request_key"),
  fingerprint: text("fingerprint"),
  status: text("status").notNull().default("new"),
  responseDueAt: timestamp("response_due_at"),
  assignedToUserId: integer("assigned_to_user_id"),
  assignedAt: timestamp("assigned_at"),
  nextActionType: text("next_action_type"),
  nextActionDueAt: timestamp("next_action_due_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  check("contact_submissions_plan_chk",sql`${table.plan} is null or ${table.plan} in ('free','professional','team','business','enterprise','founding')`),
  check("contact_submissions_billing_cycle_chk",sql`${table.billingCycle} is null or ${table.billingCycle} in ('monthly','annual')`),
  check("contact_submissions_status_chk",sql`${table.status} in ('new','acknowledged','qualified','closed')`),
  check("contact_submissions_next_action_type_chk",sql`${table.nextActionType} is null or ${table.nextActionType} in ('call','demo','email','proposal')`),
  check("contact_submissions_next_action_pair_chk",sql`(${table.nextActionType} is null) = (${table.nextActionDueAt} is null)`),
  uniqueIndex("contact_submissions_request_key_uidx").on(table.requestKey).where(sql`${table.requestKey} is not null`),
  index("contact_submissions_status_created_idx").on(table.status,table.createdAt.desc()),
  index("contact_submissions_response_due_idx").on(table.status,table.responseDueAt),
  index("contact_submissions_next_action_due_idx").on(table.status,table.nextActionDueAt),
]);

export type ContactSubmission = typeof contactSubmissionsTable.$inferSelect;
