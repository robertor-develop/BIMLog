import {sql} from "drizzle-orm";
import {check,index,integer,pgTable,text,timestamp,uniqueIndex} from "drizzle-orm/pg-core";
import {companiesTable} from "./users";
import {usersTable} from "./users";

export const commercialSubscriptionsTable=pgTable("commercial_subscriptions",{
  id:text("id").primaryKey(),
  companyId:integer("company_id").notNull().references(()=>companiesTable.id),
  planCode:text("plan_code").notNull(),
  billingCycle:text("billing_cycle").notNull(),
  status:text("status").notNull(),
  currency:text("currency").notNull(),
  seatQuantity:integer("seat_quantity").notNull(),
  revision:integer("revision").notNull().default(1),
  startedAt:timestamp("started_at",{withTimezone:true}),
  canceledAt:timestamp("canceled_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  check("commercial_subscriptions_plan_chk",sql`${table.planCode} in ('professional','team','business','enterprise')`),
  check("commercial_subscriptions_cycle_chk",sql`${table.billingCycle} in ('monthly','annual','contract')`),
  check("commercial_subscriptions_status_chk",sql`${table.status} in ('pending','trialing','active','past_due','suspended','canceling','canceled')`),
  check("commercial_subscriptions_currency_chk",sql`${table.currency} ~ '^[A-Z]{3}$'`),
  check("commercial_subscriptions_seats_chk",sql`${table.seatQuantity}>0`),
  check("commercial_subscriptions_revision_chk",sql`${table.revision}>0`),
  uniqueIndex("commercial_subscriptions_company_active_uidx").on(table.companyId).where(sql`${table.status} in ('pending','trialing','active','past_due','suspended','canceling')`),
  index("commercial_subscriptions_company_time_idx").on(table.companyId,table.createdAt.desc()),
]);

export const commercialSubscriptionTermsTable=pgTable("commercial_subscription_terms",{
  id:text("id").primaryKey(),
  subscriptionId:text("subscription_id").notNull().references(()=>commercialSubscriptionsTable.id),
  sequence:integer("sequence").notNull(),
  status:text("status").notNull(),
  startsAt:timestamp("starts_at",{withTimezone:true}).notNull(),
  endsAt:timestamp("ends_at",{withTimezone:true}).notNull(),
  endedAt:timestamp("ended_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  check("commercial_subscription_terms_sequence_chk",sql`${table.sequence}>0`),
  check("commercial_subscription_terms_status_chk",sql`${table.status} in ('pending','active','ended','void')`),
  check("commercial_subscription_terms_dates_chk",sql`${table.endsAt}>${table.startsAt}`),
  uniqueIndex("commercial_subscription_terms_sequence_uidx").on(table.subscriptionId,table.sequence),
  index("commercial_subscription_terms_status_time_idx").on(table.subscriptionId,table.status,table.startsAt.desc()),
]);

export type CommercialSubscription=typeof commercialSubscriptionsTable.$inferSelect;
export type CommercialSubscriptionTerm=typeof commercialSubscriptionTermsTable.$inferSelect;

export const commercialSubscriptionSeatsTable=pgTable("commercial_subscription_seats",{
  id:text("id").primaryKey(),
  subscriptionId:text("subscription_id").notNull().references(()=>commercialSubscriptionsTable.id),
  companyId:integer("company_id").notNull().references(()=>companiesTable.id),
  seatNumber:integer("seat_number").notNull(),
  status:text("status").notNull(),
  assignedUserId:integer("assigned_user_id").references(()=>usersTable.id),
  assignedAt:timestamp("assigned_at",{withTimezone:true}),
  releasedAt:timestamp("released_at",{withTimezone:true}),
  revision:integer("revision").notNull().default(1),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  check("commercial_subscription_seats_number_chk",sql`${table.seatNumber}>0`),
  check("commercial_subscription_seats_status_chk",sql`${table.status} in ('available','assigned','released','revoked')`),
  check("commercial_subscription_seats_assignment_chk",sql`(${table.status}='assigned' and ${table.assignedUserId} is not null and ${table.assignedAt} is not null) or (${table.status}<>'assigned')`),
  check("commercial_subscription_seats_revision_chk",sql`${table.revision}>0`),
  uniqueIndex("commercial_subscription_seats_number_uidx").on(table.subscriptionId,table.seatNumber),
  uniqueIndex("commercial_subscription_seats_active_user_uidx").on(table.subscriptionId,table.assignedUserId).where(sql`${table.status}='assigned'`),
  index("commercial_subscription_seats_company_status_idx").on(table.companyId,table.status,table.seatNumber),
]);

export type CommercialSubscriptionSeat=typeof commercialSubscriptionSeatsTable.$inferSelect;

export const commercialOrdersTable=pgTable("commercial_orders",{
  id:text("id").primaryKey(),
  companyId:integer("company_id").notNull().references(()=>companiesTable.id),
  subscriptionId:text("subscription_id").notNull().references(()=>commercialSubscriptionsTable.id),
  requestKey:text("request_key").notNull(),
  fingerprint:text("fingerprint").notNull(),
  status:text("status").notNull(),
  currency:text("currency").notNull(),
  subtotalCents:integer("subtotal_cents").notNull(),
  taxCents:integer("tax_cents"),
  totalCents:integer("total_cents"),
  createdByUserId:integer("created_by_user_id").notNull().references(()=>usersTable.id),
  submittedAt:timestamp("submitted_at",{withTimezone:true}),
  completedAt:timestamp("completed_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  check("commercial_orders_status_chk",sql`${table.status} in ('draft','ready','submitted','completed','canceled','failed')`),
  check("commercial_orders_currency_chk",sql`${table.currency} ~ '^[A-Z]{3}$'`),
  check("commercial_orders_amounts_chk",sql`${table.subtotalCents}>=0 and (${table.taxCents} is null or ${table.taxCents}>=0) and (${table.totalCents} is null or ${table.totalCents}>=0)`),
  check("commercial_orders_total_chk",sql`${table.totalCents} is null or (${table.taxCents} is not null and ${table.totalCents}=${table.subtotalCents}+${table.taxCents})`),
  uniqueIndex("commercial_orders_company_request_uidx").on(table.companyId,table.requestKey),
  index("commercial_orders_subscription_time_idx").on(table.subscriptionId,table.createdAt.desc()),
]);

export type CommercialOrder=typeof commercialOrdersTable.$inferSelect;
