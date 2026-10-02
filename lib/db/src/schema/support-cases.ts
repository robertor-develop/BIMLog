import {check,index,integer,pgTable,serial,text,timestamp,uniqueIndex} from "drizzle-orm/pg-core";
import {sql} from "drizzle-orm";
import {companiesTable} from "./company_profiles";
import {usersTable} from "./users";

export const supportCasesTable=pgTable("support_cases",{
  id:serial("id").primaryKey(),companyId:integer("company_id").notNull().references(()=>companiesTable.id),requesterUserId:integer("requester_user_id").notNull().references(()=>usersTable.id),
  category:text("category").notNull(),priority:text("priority").notNull(),subject:text("subject").notNull(),description:text("description").notNull(),requestKey:text("request_key").notNull(),fingerprint:text("fingerprint").notNull(),status:text("status").notNull().default("open"),createdAt:timestamp("created_at").notNull().defaultNow(),updatedAt:timestamp("updated_at").notNull().defaultNow(),
},table=>[
  check("support_cases_category_chk",sql`${table.category} in ('billing','account','technical','data','other')`),check("support_cases_priority_chk",sql`${table.priority} in ('normal','urgent')`),check("support_cases_status_chk",sql`${table.status} in ('open','in_progress','resolved','closed')`),uniqueIndex("support_cases_requester_request_key_uidx").on(table.requesterUserId,table.requestKey),index("support_cases_company_created_idx").on(table.companyId,table.createdAt.desc()),
]);
export type SupportCase=typeof supportCasesTable.$inferSelect;
