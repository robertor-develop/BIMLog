import { bigserial, check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { lensViewpointsTable } from "./lens-viewpoints";

export const lensNextRevitNavigationEventsTable=pgTable("lens_next_revit_navigation_events",{
  id:bigserial("id",{mode:"number"}).primaryKey(),
  projectId:integer("project_id").notNull().references(()=>projectsTable.id),
  lensViewpointId:integer("lens_viewpoint_id").notNull().references(()=>lensViewpointsTable.id),
  requestId:uuid("request_id").notNull().unique("lens_next_revit_navigation_events_request_id_key"),
  requestedById:integer("requested_by_id").notNull().references(()=>usersTable.id),
  targetDigest:text("target_digest").notNull(),
  targetJson:jsonb("target_json").$type<Record<string,unknown>>().notNull(),
  outcome:text("outcome").notNull().default("requested"),
  receiptJson:jsonb("receipt_json").$type<Record<string,unknown>>(),
  requestedAt:timestamp("requested_at",{withTimezone:true}).notNull().defaultNow(),
  expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),
  completedAt:timestamp("completed_at",{withTimezone:true}),
},table=>({
  projectIssueIndex:index("lens_next_revit_navigation_project_issue_idx").on(table.projectId,table.lensViewpointId,table.requestedAt.desc()),
  digestCheck:check("lens_next_revit_navigation_digest_chk",sql`${table.targetDigest} ~ '^[a-f0-9]{64}$'`),
  outcomeCheck:check("lens_next_revit_navigation_outcome_chk",sql`${table.outcome} IN ('requested','opened','already-opened','blocked','expired')`),
  expiryCheck:check("lens_next_revit_navigation_expiry_chk",sql`${table.expiresAt} > ${table.requestedAt}`),
}));
