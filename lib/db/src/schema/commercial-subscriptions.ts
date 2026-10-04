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

export const commercialProviderBindingsTable=pgTable("commercial_provider_bindings",{
  id:text("id").primaryKey(),
  companyId:integer("company_id").notNull().references(()=>companiesTable.id),
  provider:text("provider").notNull(),
  environment:text("environment").notNull(),
  customerReference:text("customer_reference").notNull(),
  status:text("status").notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  check("commercial_provider_bindings_provider_chk",sql`${table.provider} in ('stripe')`),
  check("commercial_provider_bindings_environment_chk",sql`${table.environment} in ('test','live')`),
  check("commercial_provider_bindings_status_chk",sql`${table.status} in ('active','revoked')`),
  uniqueIndex("commercial_provider_bindings_company_provider_uidx").on(table.companyId,table.provider,table.environment),
  uniqueIndex("commercial_provider_bindings_customer_uidx").on(table.provider,table.environment,table.customerReference),
]);

export const commercialCheckoutAttemptsTable=pgTable("commercial_checkout_attempts",{
  id:text("id").primaryKey(),
  companyId:integer("company_id").notNull().references(()=>companiesTable.id),
  orderId:text("order_id").notNull().references(()=>commercialOrdersTable.id),
  providerBindingId:text("provider_binding_id").notNull().references(()=>commercialProviderBindingsTable.id),
  idempotencyKey:text("idempotency_key").notNull(),
  requestFingerprint:text("request_fingerprint").notNull(),
  providerSessionReference:text("provider_session_reference"),
  status:text("status").notNull(),
  expiresAt:timestamp("expires_at",{withTimezone:true}).notNull(),
  completedAt:timestamp("completed_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  check("commercial_checkout_attempts_status_chk",sql`${table.status} in ('creating','open','completed','expired','canceled','failed')`),
  uniqueIndex("commercial_checkout_attempts_company_key_uidx").on(table.companyId,table.idempotencyKey),
  uniqueIndex("commercial_checkout_attempts_provider_session_uidx").on(table.providerBindingId,table.providerSessionReference).where(sql`${table.providerSessionReference} is not null`),
  index("commercial_checkout_attempts_order_time_idx").on(table.orderId,table.createdAt.desc()),
]);

export type CommercialProviderBinding=typeof commercialProviderBindingsTable.$inferSelect;
export type CommercialCheckoutAttempt=typeof commercialCheckoutAttemptsTable.$inferSelect;

export const commercialInvoicesTable=pgTable("commercial_invoices",{
  id:text("id").primaryKey(),
  companyId:integer("company_id").notNull().references(()=>companiesTable.id),
  subscriptionId:text("subscription_id").notNull().references(()=>commercialSubscriptionsTable.id),
  orderId:text("order_id").notNull().references(()=>commercialOrdersTable.id),
  checkoutAttemptId:text("checkout_attempt_id").notNull().references(()=>commercialCheckoutAttemptsTable.id),
  invoiceNumber:text("invoice_number").notNull(),
  provider:text("provider").notNull(),
  providerInvoiceReference:text("provider_invoice_reference").notNull(),
  currency:text("currency").notNull(),
  subtotalCents:integer("subtotal_cents").notNull(),
  taxCents:integer("tax_cents").notNull(),
  totalCents:integer("total_cents").notNull(),
  status:text("status").notNull(),
  issuedAt:timestamp("issued_at",{withTimezone:true}).notNull(),
  dueAt:timestamp("due_at",{withTimezone:true}),
  paidAt:timestamp("paid_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  check("commercial_invoices_provider_chk",sql`${table.provider} in ('stripe')`),
  check("commercial_invoices_currency_chk",sql`${table.currency} ~ '^[A-Z]{3}$'`),
  check("commercial_invoices_status_chk",sql`${table.status} in ('draft','open','paid','void','uncollectible')`),
  check("commercial_invoices_amounts_chk",sql`${table.subtotalCents}>=0 and ${table.taxCents}>=0 and ${table.totalCents}=${table.subtotalCents}+${table.taxCents}`),
  check("commercial_invoices_paid_chk",sql`${table.status}<>'paid' or ${table.paidAt} is not null`),
  uniqueIndex("commercial_invoices_number_uidx").on(table.invoiceNumber),
  uniqueIndex("commercial_invoices_provider_ref_uidx").on(table.provider,table.providerInvoiceReference),
  uniqueIndex("commercial_invoices_checkout_uidx").on(table.checkoutAttemptId),
  index("commercial_invoices_company_time_idx").on(table.companyId,table.issuedAt.desc()),
  index("commercial_invoices_subscription_time_idx").on(table.subscriptionId,table.issuedAt.desc()),
]);

export type CommercialInvoiceRecord=typeof commercialInvoicesTable.$inferSelect;
