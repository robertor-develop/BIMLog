import {sql} from "drizzle-orm";
import {boolean,check,foreignKey,index,integer,jsonb,pgTable,primaryKey,serial,text,timestamp} from "drizzle-orm/pg-core";
import {companiesTable,usersTable} from "./users";
import {projectsTable} from "./projects";
export const companyCommercialEntitlementEventsTable=pgTable("company_commercial_entitlement_events",{
 sequence:serial("sequence").primaryKey(),eventKey:text("event_key").notNull().unique("company_commercial_entitlement_events_event_key_key"),
 companyId:integer("company_id").notNull(),enabled:boolean("enabled").notNull(),reason:text("reason").notNull(),actorUserId:integer("actor_user_id"),source:text("source").notNull(),featureKey:text("feature_key").notNull().default("package"),occurredAt:timestamp("occurred_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({name:"company_commercial_entitlement_events_company_id_fkey",columns:[t.companyId],foreignColumns:[companiesTable.id]}),foreignKey({name:"company_commercial_entitlement_events_actor_user_id_fkey",columns:[t.actorUserId],foreignColumns:[usersTable.id]}),
 check("company_commercial_entitlement_events_source_check",sql`${t.source} in ('owner_instruction','super_admin')`),check("company_commercial_entitlement_events_feature_key_check",sql`${t.featureKey} = 'package'`),check("company_commercial_entitlement_reason_chk",sql`length(${t.reason}) between 3 and 1000`),index("company_commercial_entitlement_sequence_idx").on(t.companyId,t.featureKey,t.sequence.desc().nullsFirst()),
]);
export const companyProviderApprovalEventsTable=pgTable("company_provider_approval_events",{
 sequence:serial("sequence").primaryKey(),eventKey:text("event_key").notNull().unique("company_provider_approval_events_event_key_key"),companyId:integer("company_id").notNull(),providerKey:text("provider_key").notNull(),operation:text("operation").notNull(),enabled:boolean("enabled").notNull(),reason:text("reason").notNull(),actorUserId:integer("actor_user_id"),source:text("source").notNull(),occurredAt:timestamp("occurred_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 foreignKey({name:"company_provider_approval_events_company_id_fkey",columns:[t.companyId],foreignColumns:[companiesTable.id]}),foreignKey({name:"company_provider_approval_events_actor_user_id_fkey",columns:[t.actorUserId],foreignColumns:[usersTable.id]}),check("company_provider_approval_events_source_check",sql`${t.source} in ('owner_instruction','super_admin')`),check("company_provider_approval_reason_chk",sql`length(${t.reason}) between 3 and 1000`),index("company_provider_approval_latest_idx").on(t.companyId,t.providerKey,t.operation,t.sequence.desc().nullsFirst()),
]);
export const procoreIntakeStatesTable=pgTable("procore_intake_states",{
 userId:integer("user_id").notNull(),companyId:integer("company_id").notNull(),projectId:integer("project_id").notNull(),goal:text("goal").notNull().default(""),needed:text("needed").notNull().default(""),destinationProjectId:integer("destination_project_id").notNull(),messages:jsonb("messages").notNull().default(sql`'[]'::jsonb`),selectedSources:jsonb("selected_sources").notNull().default(sql`'[]'::jsonb`),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
 primaryKey({name:"procore_intake_states_pkey",columns:[t.userId,t.companyId,t.projectId]}),foreignKey({name:"procore_intake_states_user_id_fkey",columns:[t.userId],foreignColumns:[usersTable.id]}),foreignKey({name:"procore_intake_states_company_id_fkey",columns:[t.companyId],foreignColumns:[companiesTable.id]}),foreignKey({name:"procore_intake_states_project_id_fkey",columns:[t.projectId],foreignColumns:[projectsTable.id]}),
]);
