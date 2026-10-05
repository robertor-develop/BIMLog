import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const platformRepairDelegatesTable=pgTable("platform_repair_delegates",{
  companyId:integer("company_id").notNull(),userId:integer("user_id").notNull().references(()=>usersTable.id),grantedById:integer("granted_by_id").notNull().references(()=>usersTable.id),active:boolean("active").notNull().default(true),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[primaryKey({columns:[table.companyId,table.userId]})]);

export const platformRepairPinsTable=pgTable("platform_repair_pins",{
  userId:integer("user_id").primaryKey().references(()=>usersTable.id),salt:text("salt").notNull(),digest:text("digest").notNull(),attempts:integer("attempts").notNull().default(0),windowUntil:timestamp("window_until",{withTimezone:true}),version:integer("version").notNull().default(1),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});

export const platformRepairProposalsTable=pgTable("platform_repair_proposals",{
  id:uuid("id").primaryKey(),companyId:integer("company_id").notNull(),projectId:integer("project_id"),reporterId:integer("reporter_id").notNull().references(()=>usersTable.id),payload:jsonb("payload").notNull(),scopeDigest:text("scope_digest").notNull(),state:text("state").notNull(),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),approvedById:integer("approved_by_id").references(()=>usersTable.id),expiresAt:timestamp("expires_at",{withTimezone:true}),executionReceipt:jsonb("execution_receipt"),
},table=>[index("platform_repair_proposals_company_created_idx").on(table.companyId,table.createdAt.desc())]);

export const platformRepairEventsTable=pgTable("platform_repair_events",{
  id:uuid("id").primaryKey(),companyId:integer("company_id").notNull(),actorId:integer("actor_id").notNull().references(()=>usersTable.id),proposalId:uuid("proposal_id"),action:text("action").notNull(),evidence:jsonb("evidence").notNull().default({}),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
