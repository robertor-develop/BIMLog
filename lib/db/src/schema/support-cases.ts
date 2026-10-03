import {check,index,integer,pgTable,serial,text,timestamp,uniqueIndex} from "drizzle-orm/pg-core";
import {sql} from "drizzle-orm";
import {companiesTable,usersTable} from "./users";

export const supportCasesTable=pgTable("support_cases",{
  id:serial("id").primaryKey(),companyId:integer("company_id").notNull().references(()=>companiesTable.id),requesterUserId:integer("requester_user_id").notNull().references(()=>usersTable.id),
  category:text("category").notNull(),priority:text("priority").notNull(),subject:text("subject").notNull(),description:text("description").notNull(),requestKey:text("request_key").notNull(),fingerprint:text("fingerprint").notNull(),status:text("status").notNull().default("open"),responseDueAt:timestamp("response_due_at"),assignedToUserId:integer("assigned_to_user_id").references(()=>usersTable.id),assignedAt:timestamp("assigned_at"),createdAt:timestamp("created_at").notNull().defaultNow(),updatedAt:timestamp("updated_at").notNull().defaultNow(),
},table=>[
  check("support_cases_category_chk",sql`${table.category} in ('billing','account','technical','data','other')`),check("support_cases_priority_chk",sql`${table.priority} in ('normal','urgent')`),check("support_cases_status_chk",sql`${table.status} in ('open','in_progress','resolved','closed')`),uniqueIndex("support_cases_requester_request_key_uidx").on(table.requesterUserId,table.requestKey),index("support_cases_company_created_idx").on(table.companyId,table.createdAt.desc()),index("support_cases_response_due_idx").on(table.status,table.responseDueAt),
]);
export type SupportCase=typeof supportCasesTable.$inferSelect;

export const supportCaseMessagesTable=pgTable("support_case_messages",{
  id:serial("id").primaryKey(),supportCaseId:integer("support_case_id").notNull().references(()=>supportCasesTable.id),authorUserId:integer("author_user_id").notNull().references(()=>usersTable.id),authorRole:text("author_role").notNull(),body:text("body").notNull(),requestKey:text("request_key").notNull(),fingerprint:text("fingerprint").notNull(),createdAt:timestamp("created_at").notNull().defaultNow(),
},table=>[
  check("support_case_messages_author_role_chk",sql`${table.authorRole} in ('customer','administrator')`),uniqueIndex("support_case_messages_author_request_uidx").on(table.supportCaseId,table.authorUserId,table.requestKey),index("support_case_messages_case_created_idx").on(table.supportCaseId,table.createdAt,table.id),
]);
export type SupportCaseMessage=typeof supportCaseMessagesTable.$inferSelect;
export const supportConversationReadsTable=pgTable("support_conversation_reads",{
  id:serial("id").primaryKey(),supportCaseId:integer("support_case_id").notNull().references(()=>supportCasesTable.id),userId:integer("user_id").notNull().references(()=>usersTable.id),lastReadMessageId:integer("last_read_message_id").notNull().references(()=>supportCaseMessagesTable.id),updatedAt:timestamp("updated_at").notNull().defaultNow(),
},table=>[uniqueIndex("support_conversation_reads_case_user_uidx").on(table.supportCaseId,table.userId)]);
