import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { financialContractsTable } from "./financial-contracts";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";

export const enterpriseContactsTable = pgTable(
  "enterprise_contacts",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    linkedUserId: integer("linked_user_id"),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    title: text("title"),
    state: text("state").default("active").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (t) => [
    unique("enterprise_contacts_id_company_uq").on(t.id, t.companyId),
    unique("enterprise_contacts_company_email_uq").on(t.companyId, t.email),
    foreignKey({ columns: [t.companyId], foreignColumns: [companiesTable.id], name: "enterprise_contacts_company_fk" }),
    foreignKey({ columns: [t.linkedUserId], foreignColumns: [usersTable.id], name: "enterprise_contacts_user_fk" }),
    foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "enterprise_contacts_creator_fk" }),
    check("enterprise_contacts_state_chk", sql`${t.state} IN ('active','inactive','retired')`),
    check("enterprise_contacts_lifecycle_chk", sql`(${t.state} = 'retired') = (${t.retiredAt} IS NOT NULL)`),
  ],
);

export const projectCompanyRelationshipsTable = pgTable(
  "project_company_relationships",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    companyId: integer("company_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    state: text("state").default("active").notNull(),
    sourceType: text("source_type").default("manual").notNull(),
    sourceRecordId: text("source_record_id"),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (t) => [
    unique("project_company_relationship_id_project_uq").on(t.id, t.projectId),
    unique("project_company_relationship_id_project_company_uq").on(t.id, t.projectId, t.companyId),
    unique("project_company_relationship_project_company_role_uq").on(t.projectId, t.companyId, t.relationshipType),
    foreignKey({ columns: [t.projectId], foreignColumns: [projectsTable.id], name: "project_company_relationship_project_fk" }),
    foreignKey({ columns: [t.companyId], foreignColumns: [companiesTable.id], name: "project_company_relationship_company_fk" }),
    foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "project_company_relationship_creator_fk" }),
    check("project_company_relationship_type_chk", sql`${t.relationshipType} IN ('client','owner','general_contractor','service_provider','trade_contractor','consultant','vendor','partner','authority','other')`),
    check("project_company_relationship_state_chk", sql`${t.state} IN ('active','inactive','retired')`),
    check("project_company_relationship_lifecycle_chk", sql`(${t.state} = 'retired') = (${t.retiredAt} IS NOT NULL)`),
  ],
);

export const projectContactRelationshipsTable = pgTable(
  "project_contact_relationships",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    companyId: integer("company_id").notNull(),
    projectCompanyRelationshipId: integer("project_company_relationship_id").notNull(),
    contactId: integer("contact_id").notNull(),
    contactRole: text("contact_role").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    state: text("state").default("active").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("project_contact_relationship_project_contact_role_uq").on(t.projectId, t.contactId, t.contactRole),
    foreignKey({ columns: [t.projectCompanyRelationshipId, t.projectId, t.companyId], foreignColumns: [projectCompanyRelationshipsTable.id, projectCompanyRelationshipsTable.projectId, projectCompanyRelationshipsTable.companyId], name: "project_contact_relationship_project_company_fk" }),
    foreignKey({ columns: [t.contactId, t.companyId], foreignColumns: [enterpriseContactsTable.id, enterpriseContactsTable.companyId], name: "project_contact_relationship_contact_company_fk" }),
    foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "project_contact_relationship_creator_fk" }),
    check("project_contact_relationship_state_chk", sql`${t.state} IN ('active','inactive','retired')`),
  ],
);

export const enterpriseTradesTable = pgTable(
  "enterprise_trades",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    state: text("state").default("active").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "enterprise_trades_creator_fk" }),
    check("enterprise_trades_code_chk", sql`${t.code} ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'`),
    check("enterprise_trades_state_chk", sql`${t.state} IN ('active','inactive','retired')`),
  ],
);

export const companyTradeRelationshipsTable = pgTable(
  "company_trade_relationships",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    companyId: integer("company_id").notNull(),
    projectCompanyRelationshipId: integer("project_company_relationship_id").notNull(),
    tradeId: integer("trade_id").notNull(),
    state: text("state").default("active").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("company_trade_relationship_project_company_trade_uq").on(t.projectId, t.companyId, t.tradeId),
    foreignKey({ columns: [t.projectCompanyRelationshipId, t.projectId, t.companyId], foreignColumns: [projectCompanyRelationshipsTable.id, projectCompanyRelationshipsTable.projectId, projectCompanyRelationshipsTable.companyId], name: "company_trade_relationship_project_company_fk" }),
    foreignKey({ columns: [t.tradeId], foreignColumns: [enterpriseTradesTable.id], name: "company_trade_relationship_trade_fk" }),
    foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "company_trade_relationship_creator_fk" }),
    check("company_trade_relationship_state_chk", sql`${t.state} IN ('active','inactive','retired')`),
  ],
);

export const contractPartyRelationshipsTable = pgTable(
  "contract_party_relationships",
  {
    id: serial("id").primaryKey(),
    contractId: text("contract_id").notNull(),
    projectId: integer("project_id").notNull(),
    projectCompanyRelationshipId: integer("project_company_relationship_id").notNull(),
    partyRole: text("party_role").notNull(),
    state: text("state").default("active").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("contract_party_relationship_contract_company_role_uq").on(t.contractId, t.projectCompanyRelationshipId, t.partyRole),
    foreignKey({ columns: [t.contractId, t.projectId], foreignColumns: [financialContractsTable.id, financialContractsTable.projectId], name: "contract_party_relationship_contract_project_fk" }),
    foreignKey({ columns: [t.projectCompanyRelationshipId, t.projectId], foreignColumns: [projectCompanyRelationshipsTable.id, projectCompanyRelationshipsTable.projectId], name: "contract_party_relationship_project_company_fk" }),
    foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "contract_party_relationship_creator_fk" }),
    check("contract_party_relationship_role_chk", sql`${t.partyRole} IN ('client','owner','contractor','subcontractor','consultant','vendor','guarantor','other')`),
    check("contract_party_relationship_state_chk", sql`${t.state} IN ('active','inactive','retired')`),
  ],
);
