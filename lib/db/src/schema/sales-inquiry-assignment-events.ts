import {sql} from "drizzle-orm";
import {check,index,integer,pgTable,serial,text,timestamp} from "drizzle-orm/pg-core";
import {contactSubmissionsTable} from "./contact-submissions";
import {usersTable} from "./users";

export const salesInquiryAssignmentEventsTable=pgTable("sales_inquiry_assignment_events",{
  id:serial("id").primaryKey(),
  inquiryId:integer("inquiry_id").notNull().references(()=>contactSubmissionsTable.id),
  actorUserId:integer("actor_user_id").notNull().references(()=>usersTable.id),
  previousAssigneeUserId:integer("previous_assignee_user_id").references(()=>usersTable.id),
  nextAssigneeUserId:integer("next_assignee_user_id").references(()=>usersTable.id),
  action:text("action").notNull(),
  createdAt:timestamp("created_at").defaultNow().notNull(),
},table=>[
  check("sales_inquiry_assignment_events_action_chk",sql`${table.action} in ('assigned','released')`),
  index("sales_inquiry_assignment_events_inquiry_idx").on(table.inquiryId,table.createdAt.desc()),
]);

export type SalesInquiryAssignmentEvent=typeof salesInquiryAssignmentEventsTable.$inferSelect;
