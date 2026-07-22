import {
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companiesTable, usersTable } from "./users";
import { projectsTable } from "./projects";
import { filesTable } from "./files";
import { scheduleItemPlacementsTable } from "./schedule-planner";
import {
  approvedBudgetSnapshotLinesTable,
  approvedBudgetSnapshotsTable,
  projectCostNodesTable,
  projectCostStructureVersionsTable,
} from "./financial-budgets";

export const financialContractsTable = pgTable(
  "financial_contracts",
  {
    id: text("id").primaryKey(),
    bimlogId: text("bimlog_id").notNull().unique(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    projectId: integer("project_id").references(() => projectsTable.id).notNull(),
    perspective: text("perspective").notNull(),
    contractType: text("contract_type").notNull(),
    legalNumber: text("legal_number").notNull(),
    counterpartyName: text("counterparty_name").notNull(),
    createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("financial_contract_project_number_uidx").on(t.projectId, t.perspective, t.legalNumber),
    check("financial_contract_perspective_chk", sql`${t.perspective} IN ('upstream','downstream')`),
    check("financial_contract_type_chk", sql`${t.contractType} IN ('owner_prime','subcontract','purchase_order','consultant_agreement','other_commitment')`),
  ],
);

export const financialContractVersionsTable = pgTable(
  "financial_contract_versions",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").references(() => financialContractsTable.id).notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    currency: text("currency").notNull(),
    originalValue: numeric("original_value", { precision: 30, scale: 6 }).notNull(),
    effectiveDate: date("effective_date"),
    completionDate: date("completion_date"),
    paymentTerms: text("payment_terms"),
    commercialMetadata: jsonb("commercial_metadata").$type<Record<string, unknown>>().notNull().default({}),
    budgetSnapshotId: text("budget_snapshot_id").references(() => approvedBudgetSnapshotsTable.id).notNull(),
    structureVersionId: text("structure_version_id").references(() => projectCostStructureVersionsTable.id).notNull(),
    signedFileId: integer("signed_file_id").references(() => filesTable.id),
    preparedById: integer("prepared_by_id").references(() => usersTable.id).notNull(),
    submittedById: integer("submitted_by_id").references(() => usersTable.id),
    reviewedById: integer("reviewed_by_id").references(() => usersTable.id),
    approvedById: integer("approved_by_id").references(() => usersTable.id),
    executedById: integer("executed_by_id").references(() => usersTable.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    outcomeReason: text("outcome_reason"),
    overBudgetReason: text("over_budget_reason"),
    approvalPolicyId: text("approval_policy_id"),
    higherApprovalPolicyId: text("higher_approval_policy_id"),
    executionPolicyId: text("execution_policy_id"),
    contentFingerprint: text("content_fingerprint").notNull(),
    revision: integer("revision").default(1).notNull(),
    supersedesId: text("supersedes_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("financial_contract_version_uidx").on(t.contractId, t.version),
    check("financial_contract_version_status_chk", sql`${t.status} IN ('draft','submitted','under_review','approved','returned','rejected','withdrawn','executed','superseded','terminated','voided','closed')`),
    check("financial_contract_version_currency_chk", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("financial_contract_original_value_chk", sql`${t.originalValue} >= 0`),
  ],
);

export const financialContractSovLinesTable = pgTable(
  "financial_contract_sov_lines",
  {
    id: text("id").primaryKey(),
    contractVersionId: text("contract_version_id").references(() => financialContractVersionsTable.id).notNull(),
    stableLineId: text("stable_line_id").notNull(),
    budgetSnapshotLineId: text("budget_snapshot_line_id").references(() => approvedBudgetSnapshotLinesTable.id).notNull(),
    projectCostNodeId: text("project_cost_node_id").references(() => projectCostNodesTable.id).notNull(),
    scheduleItemPlacementId: integer("schedule_item_placement_id").references(() => scheduleItemPlacementsTable.id),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 30, scale: 6 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    uniqueIndex("financial_contract_sov_line_uidx").on(t.contractVersionId, t.stableLineId),
    check("financial_contract_sov_amount_chk", sql`${t.amount} >= 0`),
  ],
);

export const financialContractAmendmentsTable = pgTable(
  "financial_contract_amendments",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").references(() => financialContractsTable.id).notNull(),
    bimlogId: text("bimlog_id").notNull().unique(),
    legalNumber: text("legal_number").notNull(),
    createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("financial_amendment_contract_number_uidx").on(t.contractId, t.legalNumber)],
);

export const financialContractAmendmentVersionsTable = pgTable(
  "financial_contract_amendment_versions",
  {
    id: text("id").primaryKey(),
    amendmentId: text("amendment_id").references(() => financialContractAmendmentsTable.id).notNull(),
    contractVersionId: text("contract_version_id").references(() => financialContractVersionsTable.id).notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    currency: text("currency").notNull(),
    amountDelta: numeric("amount_delta", { precision: 30, scale: 6 }).notNull(),
    budgetSnapshotId: text("budget_snapshot_id").references(() => approvedBudgetSnapshotsTable.id).notNull(),
    structureVersionId: text("structure_version_id").references(() => projectCostStructureVersionsTable.id).notNull(),
    signedFileId: integer("signed_file_id").references(() => filesTable.id),
    preparedById: integer("prepared_by_id").references(() => usersTable.id).notNull(),
    submittedById: integer("submitted_by_id").references(() => usersTable.id),
    reviewedById: integer("reviewed_by_id").references(() => usersTable.id),
    approvedById: integer("approved_by_id").references(() => usersTable.id),
    executedById: integer("executed_by_id").references(() => usersTable.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    outcomeReason: text("outcome_reason"),
    overBudgetReason: text("over_budget_reason"),
    approvalPolicyId: text("approval_policy_id"),
    higherApprovalPolicyId: text("higher_approval_policy_id"),
    executionPolicyId: text("execution_policy_id"),
    contentFingerprint: text("content_fingerprint").notNull(),
    revision: integer("revision").default(1).notNull(),
    supersedesId: text("supersedes_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("financial_amendment_version_uidx").on(t.amendmentId, t.version),
    check("financial_amendment_status_chk", sql`${t.status} IN ('draft','submitted','under_review','approved','returned','rejected','withdrawn','executed','superseded','voided')`),
    check("financial_amendment_currency_chk", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const financialContractAmendmentLinesTable = pgTable(
  "financial_contract_amendment_lines",
  {
    id: text("id").primaryKey(),
    amendmentVersionId: text("amendment_version_id").references(() => financialContractAmendmentVersionsTable.id).notNull(),
    stableLineId: text("stable_line_id").notNull(),
    budgetSnapshotLineId: text("budget_snapshot_line_id").references(() => approvedBudgetSnapshotLinesTable.id).notNull(),
    projectCostNodeId: text("project_cost_node_id").references(() => projectCostNodesTable.id).notNull(),
    scheduleItemPlacementId: integer("schedule_item_placement_id").references(() => scheduleItemPlacementsTable.id),
    description: text("description").notNull(),
    amountDelta: numeric("amount_delta", { precision: 30, scale: 6 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [uniqueIndex("financial_amendment_line_uidx").on(t.amendmentVersionId, t.stableLineId)],
);

export const financialContractImportSessionsTable = pgTable(
  "financial_contract_import_sessions",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").references(() => projectsTable.id).notNull(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    actorUserId: integer("actor_user_id").references(() => usersTable.id).notNull(),
    sourceFileId: integer("source_file_id").references(() => filesTable.id).notNull(),
    fileHash: text("file_hash").notNull(),
    parsedFingerprint: text("parsed_fingerprint").notNull(),
    currency: text("currency").notNull(),
    total: numeric("total", { precision: 30, scale: 6 }).notNull(),
    acceptedCount: integer("accepted_count").notNull(),
    rejectedCount: integer("rejected_count").notNull(),
    preview: jsonb("preview").notNull(),
    confirmedContractVersionId: text("confirmed_contract_version_id").references(() => financialContractVersionsTable.id).unique(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("financial_contract_import_project_key_uidx").on(t.projectId, t.idempotencyKey)],
);

export const financialContractRecordGrantsTable = pgTable(
  "financial_contract_record_grants",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").references(() => financialContractsTable.id).notNull(),
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    permission: text("permission").notNull(),
    version: integer("version").notNull(),
    state: text("state").notNull(),
    reason: text("reason").notNull(),
    grantedById: integer("granted_by_id").references(() => usersTable.id).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("financial_contract_record_grant_version_uidx").on(t.contractId, t.userId, t.permission, t.version),
    check("financial_contract_record_permission_chk", sql`${t.permission} IN ('view','prepare','review','approve','execute','manage')`),
    check("financial_contract_record_grant_state_chk", sql`${t.state} IN ('active','revoked')`),
  ],
);

export const financialContractHistoryTable = pgTable(
  "financial_contract_history",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    projectId: integer("project_id").references(() => projectsTable.id).notNull(),
    contractId: text("contract_id").references(() => financialContractsTable.id).notNull(),
    contractVersionId: text("contract_version_id").references(() => financialContractVersionsTable.id),
    amendmentId: text("amendment_id").references(() => financialContractAmendmentsTable.id),
    amendmentVersionId: text("amendment_version_id").references(() => financialContractAmendmentVersionsTable.id),
    actorUserId: integer("actor_user_id").references(() => usersTable.id).notNull(),
    eventType: text("event_type").notNull(),
    beforeState: text("before_state"),
    afterState: text("after_state"),
    reasonCode: text("reason_code").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
);
