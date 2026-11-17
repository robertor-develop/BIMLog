import {check,index,integer,jsonb,pgTable,text,timestamp,unique} from "drizzle-orm/pg-core";
import {sql} from "drizzle-orm";
import {companiesTable,usersTable} from "./users";
import {projectsTable} from "./projects";
import {jobIntakesTable} from "./job-intakes";

export const bimtechSetupPackageImportsTable=pgTable("bimtech_setup_package_imports",{
 id:text("id").primaryKey(),companyId:integer("company_id").notNull().references(()=>companiesTable.id),projectId:integer("project_id").notNull().references(()=>projectsTable.id),
 sourceOrganizationId:text("source_organization_id").notNull(),sourceProjectId:text("source_project_id").notNull(),sourceExportId:text("source_export_id").notNull(),sourceRevision:integer("source_revision").notNull(),
 contentSha256:text("content_sha256").notNull(),packageSha256:text("package_sha256").notNull(),packageJson:jsonb("package_json").$type<Record<string,unknown>>().notNull(),previewJson:jsonb("preview_json").$type<Record<string,unknown>>().notNull(),mappingsJson:jsonb("mappings_json").$type<Record<string,unknown>>().notNull().default({}),
 status:text("status").notNull().default("staged"),targetIntakeId:text("target_intake_id").references(()=>jobIntakesTable.id),requestedById:integer("requested_by_id").notNull().references(()=>usersTable.id),appliedById:integer("applied_by_id").references(()=>usersTable.id),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),appliedAt:timestamp("applied_at",{withTimezone:true}),
},table=>[
 unique("bimtech_setup_package_imports_project_id_content_sha256_key").on(table.projectId,table.contentSha256),
 index("bimtech_setup_package_project_idx").on(table.projectId,table.createdAt),
 check("bimtech_setup_status_chk",sql`${table.status} IN ('staged','mapped','applied','rejected')`),
]);

export const bimtechSetupPackageEventsTable=pgTable("bimtech_setup_package_events",{
 id:text("id").primaryKey(),importId:text("import_id").notNull().references(()=>bimtechSetupPackageImportsTable.id),projectId:integer("project_id").notNull().references(()=>projectsTable.id),actorUserId:integer("actor_user_id").notNull().references(()=>usersTable.id),
 eventType:text("event_type").notNull(),evidence:jsonb("evidence").$type<Record<string,unknown>>().notNull().default({}),createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[index("bimtech_setup_package_events_import_idx").on(table.importId,table.createdAt)]);
