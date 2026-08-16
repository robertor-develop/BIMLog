import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
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
    bimlogId: text("bimlog_id").notNull(),
    companyId: integer("company_id").notNull(),
    projectId: integer("project_id").notNull(),
    perspective: text("perspective").notNull(),
    contractType: text("contract_type").notNull(),
    legalNumber: text("legal_number").notNull(),
    counterpartyName: text("counterparty_name").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("financial_contracts_bimlog_id_key").on(t.bimlogId),
    unique("financial_contracts_project_id_perspective_legal_number_key").on(
      t.projectId,
      t.perspective,
      t.legalNumber,
    ),
    foreignKey({
      columns: [t.companyId],
      foreignColumns: [companiesTable.id],
      name: "financial_contracts_company_id_fkey",
    }),
    foreignKey({
      columns: [t.projectId],
      foreignColumns: [projectsTable.id],
      name: "financial_contracts_project_id_fkey",
    }),
    foreignKey({
      columns: [t.createdById],
      foreignColumns: [usersTable.id],
      name: "financial_contracts_created_by_id_fkey",
    }),
    index("financial_contract_project_idx").on(
      t.projectId,
      t.perspective,
      t.createdAt,
    ),
    check(
      "financial_contract_perspective_chk",
      sql`${t.perspective} IN ('upstream','downstream')`,
    ),
    check(
      "financial_contract_type_chk",
      sql`${t.contractType} IN ('owner_prime','subcontract','purchase_order','consultant_agreement','other_commitment')`,
    ),
  ],
);

export const financialContractVersionsTable = pgTable(
  "financial_contract_versions",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    currency: text("currency").notNull(),
    originalValue: numeric("original_value", {
      precision: 30,
      scale: 6,
    }).notNull(),
    effectiveDate: date("effective_date"),
    completionDate: date("completion_date"),
    paymentTerms: text("payment_terms"),
    commercialMetadata: jsonb("commercial_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    budgetSnapshotId: text("budget_snapshot_id").notNull(),
    structureVersionId: text("structure_version_id").notNull(),
    signedFileId: integer("signed_file_id"),
    preparedById: integer("prepared_by_id").notNull(),
    submittedById: integer("submitted_by_id"),
    reviewedById: integer("reviewed_by_id"),
    approvedById: integer("approved_by_id"),
    executedById: integer("executed_by_id"),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("financial_contract_versions_contract_id_version_key").on(
      t.contractId,
      t.version,
    ),
    foreignKey({
      columns: [t.contractId],
      foreignColumns: [financialContractsTable.id],
      name: "financial_contract_versions_contract_id_fkey",
    }),
    foreignKey({
      columns: [t.budgetSnapshotId],
      foreignColumns: [approvedBudgetSnapshotsTable.id],
      name: "financial_contract_versions_budget_snapshot_id_fkey",
    }),
    foreignKey({
      columns: [t.structureVersionId],
      foreignColumns: [projectCostStructureVersionsTable.id],
      name: "financial_contract_versions_structure_version_id_fkey",
    }),
    foreignKey({
      columns: [t.signedFileId],
      foreignColumns: [filesTable.id],
      name: "financial_contract_versions_signed_file_id_fkey",
    }),
    foreignKey({
      columns: [t.preparedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_versions_prepared_by_id_fkey",
    }),
    foreignKey({
      columns: [t.submittedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_versions_submitted_by_id_fkey",
    }),
    foreignKey({
      columns: [t.reviewedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_versions_reviewed_by_id_fkey",
    }),
    foreignKey({
      columns: [t.approvedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_versions_approved_by_id_fkey",
    }),
    foreignKey({
      columns: [t.executedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_versions_executed_by_id_fkey",
    }),
    check(
      "financial_contract_version_status_chk",
      sql`${t.status} IN ('draft','submitted','under_review','approved','returned','rejected','withdrawn','executed','superseded','terminated','voided','closed')`,
    ),
    check(
      "financial_contract_version_currency_chk",
      sql`${t.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "financial_contract_original_value_chk",
      sql`${t.originalValue} >= 0`,
    ),
  ],
);

export const financialContractSovLinesTable = pgTable(
  "financial_contract_sov_lines",
  {
    id: text("id").primaryKey(),
    contractVersionId: text("contract_version_id").notNull(),
    stableLineId: text("stable_line_id").notNull(),
    budgetSnapshotLineId: text("budget_snapshot_line_id").notNull(),
    projectCostNodeId: text("project_cost_node_id").notNull(),
    scheduleItemPlacementId: integer("schedule_item_placement_id"),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 30, scale: 6 }).notNull(),
    contractItemSnapshot: jsonb("contract_item_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    unique(
      "financial_contract_sov_lines_contract_version_id_stable_lin_key",
    ).on(t.contractVersionId, t.stableLineId),
    foreignKey({
      columns: [t.contractVersionId],
      foreignColumns: [financialContractVersionsTable.id],
      name: "financial_contract_sov_lines_contract_version_id_fkey",
    }),
    foreignKey({
      columns: [t.budgetSnapshotLineId],
      foreignColumns: [approvedBudgetSnapshotLinesTable.id],
      name: "financial_contract_sov_lines_budget_snapshot_line_id_fkey",
    }),
    foreignKey({
      columns: [t.projectCostNodeId],
      foreignColumns: [projectCostNodesTable.id],
      name: "financial_contract_sov_lines_project_cost_node_id_fkey",
    }),
    foreignKey({
      columns: [t.scheduleItemPlacementId],
      foreignColumns: [scheduleItemPlacementsTable.id],
      name: "financial_contract_sov_lines_schedule_item_placement_id_fkey",
    }),
    check("financial_contract_sov_amount_chk", sql`${t.amount} >= 0`),
  ],
);

export const financialContractAmendmentsTable = pgTable(
  "financial_contract_amendments",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").notNull(),
    bimlogId: text("bimlog_id").notNull(),
    legalNumber: text("legal_number").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("financial_contract_amendments_contract_id_legal_number_key").on(
      t.contractId,
      t.legalNumber,
    ),
    unique("financial_contract_amendments_bimlog_id_key").on(t.bimlogId),
    foreignKey({
      columns: [t.contractId],
      foreignColumns: [financialContractsTable.id],
      name: "financial_contract_amendments_contract_id_fkey",
    }),
    foreignKey({
      columns: [t.createdById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_amendments_created_by_id_fkey",
    }),
  ],
);

export const financialContractAmendmentVersionsTable = pgTable(
  "financial_contract_amendment_versions",
  {
    id: text("id").primaryKey(),
    amendmentId: text("amendment_id").notNull(),
    contractVersionId: text("contract_version_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    currency: text("currency").notNull(),
    amountDelta: numeric("amount_delta", { precision: 30, scale: 6 }).notNull(),
    budgetSnapshotId: text("budget_snapshot_id").notNull(),
    structureVersionId: text("structure_version_id").notNull(),
    signedFileId: integer("signed_file_id"),
    preparedById: integer("prepared_by_id").notNull(),
    submittedById: integer("submitted_by_id"),
    reviewedById: integer("reviewed_by_id"),
    approvedById: integer("approved_by_id"),
    executedById: integer("executed_by_id"),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("financial_contract_amendment_versions_amendment_id_version_key").on(
      t.amendmentId,
      t.version,
    ),
    foreignKey({
      columns: [t.amendmentId],
      foreignColumns: [financialContractAmendmentsTable.id],
      name: "financial_contract_amendment_versions_amendment_id_fkey",
    }),
    foreignKey({
      columns: [t.contractVersionId],
      foreignColumns: [financialContractVersionsTable.id],
      name: "financial_contract_amendment_versions_contract_version_id_fkey",
    }),
    foreignKey({
      columns: [t.budgetSnapshotId],
      foreignColumns: [approvedBudgetSnapshotsTable.id],
      name: "financial_contract_amendment_versions_budget_snapshot_id_fkey",
    }),
    foreignKey({
      columns: [t.structureVersionId],
      foreignColumns: [projectCostStructureVersionsTable.id],
      name: "financial_contract_amendment_versions_structure_version_id_fkey",
    }),
    foreignKey({
      columns: [t.signedFileId],
      foreignColumns: [filesTable.id],
      name: "financial_contract_amendment_versions_signed_file_id_fkey",
    }),
    foreignKey({
      columns: [t.preparedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_amendment_versions_prepared_by_id_fkey",
    }),
    foreignKey({
      columns: [t.submittedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_amendment_versions_submitted_by_id_fkey",
    }),
    foreignKey({
      columns: [t.reviewedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_amendment_versions_reviewed_by_id_fkey",
    }),
    foreignKey({
      columns: [t.approvedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_amendment_versions_approved_by_id_fkey",
    }),
    foreignKey({
      columns: [t.executedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_amendment_versions_executed_by_id_fkey",
    }),
    check(
      "financial_amendment_status_chk",
      sql`${t.status} IN ('draft','submitted','under_review','approved','returned','rejected','withdrawn','executed','superseded','voided')`,
    ),
    check(
      "financial_amendment_currency_chk",
      sql`${t.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const financialContractAmendmentLinesTable = pgTable(
  "financial_contract_amendment_lines",
  {
    id: text("id").primaryKey(),
    amendmentVersionId: text("amendment_version_id").notNull(),
    stableLineId: text("stable_line_id").notNull(),
    budgetSnapshotLineId: text("budget_snapshot_line_id").notNull(),
    projectCostNodeId: text("project_cost_node_id").notNull(),
    scheduleItemPlacementId: integer("schedule_item_placement_id"),
    description: text("description").notNull(),
    amountDelta: numeric("amount_delta", { precision: 30, scale: 6 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    unique(
      "financial_contract_amendment__amendment_version_id_stable_l_key",
    ).on(t.amendmentVersionId, t.stableLineId),
    foreignKey({
      columns: [t.amendmentVersionId],
      foreignColumns: [financialContractAmendmentVersionsTable.id],
      name: "financial_contract_amendment_lines_amendment_version_id_fkey",
    }),
    foreignKey({
      columns: [t.budgetSnapshotLineId],
      foreignColumns: [approvedBudgetSnapshotLinesTable.id],
      name: "financial_contract_amendment_lines_budget_snapshot_line_id_fkey",
    }),
    foreignKey({
      columns: [t.projectCostNodeId],
      foreignColumns: [projectCostNodesTable.id],
      name: "financial_contract_amendment_lines_project_cost_node_id_fkey",
    }),
    foreignKey({
      columns: [t.scheduleItemPlacementId],
      foreignColumns: [scheduleItemPlacementsTable.id],
      name: "financial_contract_amendment_li_schedule_item_placement_id_fkey",
    }),
  ],
);

export const financialContractPaymentApplicationsTable = pgTable(
  "financial_contract_payment_applications",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").notNull(),
    bimlogId: text("bimlog_id").notNull(),
    applicationNumber: text("application_number").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdById: integer("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("fin_contract_payment_apps_bimlog_id_key").on(t.bimlogId),
    unique("fin_contract_payment_apps_contract_number_key").on(t.contractId, t.applicationNumber),
    unique("fin_contract_payment_apps_contract_idem_key").on(t.contractId, t.idempotencyKey),
    foreignKey({ columns: [t.contractId], foreignColumns: [financialContractsTable.id], name: "fin_contract_payment_apps_contract_id_fkey" }),
    foreignKey({ columns: [t.createdById], foreignColumns: [usersTable.id], name: "fin_contract_payment_apps_created_by_id_fkey" }),
  ],
);

export const financialContractPaymentVersionsTable = pgTable(
  "financial_contract_payment_versions",
  {
    id: text("id").primaryKey(),
    paymentApplicationId: text("payment_application_id").notNull(),
    contractVersionId: text("contract_version_id").notNull(),
    version: integer("version").notNull(),
    revision: integer("revision").default(1).notNull(),
    status: text("status").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    currency: text("currency").notNull(),
    grossAmount: numeric("gross_amount", { precision: 30, scale: 6 }).notNull(),
    retainageAmount: numeric("retainage_amount", { precision: 30, scale: 6 }).notNull(),
    netAmount: numeric("net_amount", { precision: 30, scale: 6 }).notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    preparedById: integer("prepared_by_id").notNull(),
    submittedById: integer("submitted_by_id"),
    approvedById: integer("approved_by_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    outcomeReason: text("outcome_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("fin_contract_payment_versions_app_version_key").on(t.paymentApplicationId, t.version),
    foreignKey({ columns: [t.paymentApplicationId], foreignColumns: [financialContractPaymentApplicationsTable.id], name: "fin_contract_payment_versions_app_id_fkey" }),
    foreignKey({ columns: [t.contractVersionId], foreignColumns: [financialContractVersionsTable.id], name: "fin_contract_payment_versions_contract_ver_fkey" }),
    foreignKey({ columns: [t.preparedById], foreignColumns: [usersTable.id], name: "fin_contract_payment_versions_prepared_by_fkey" }),
    foreignKey({ columns: [t.submittedById], foreignColumns: [usersTable.id], name: "fin_contract_payment_versions_submitted_by_fkey" }),
    foreignKey({ columns: [t.approvedById], foreignColumns: [usersTable.id], name: "fin_contract_payment_versions_approved_by_fkey" }),
    check("fin_contract_payment_status_chk", sql`${t.status} IN ('draft','submitted','approved','returned','rejected','withdrawn','voided')`),
    check("fin_contract_payment_currency_chk", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("fin_contract_payment_amounts_chk", sql`${t.grossAmount} >= 0 AND ${t.retainageAmount} >= 0 AND ${t.netAmount} >= 0 AND ${t.netAmount} = ${t.grossAmount} - ${t.retainageAmount}`),
    check("fin_contract_payment_period_chk", sql`${t.periodEnd} >= ${t.periodStart}`),
  ],
);

export const financialContractPaymentLinesTable = pgTable(
  "financial_contract_payment_lines",
  {
    id: text("id").primaryKey(),
    paymentVersionId: text("payment_version_id").notNull(),
    contractSovLineId: text("contract_sov_line_id").notNull(),
    currentAmount: numeric("current_amount", { precision: 30, scale: 6 }).notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    unique("fin_contract_payment_lines_version_sov_key").on(t.paymentVersionId, t.contractSovLineId),
    foreignKey({ columns: [t.paymentVersionId], foreignColumns: [financialContractPaymentVersionsTable.id], name: "fin_contract_payment_lines_version_id_fkey" }),
    foreignKey({ columns: [t.contractSovLineId], foreignColumns: [financialContractSovLinesTable.id], name: "fin_contract_payment_lines_sov_line_id_fkey" }),
    check("fin_contract_payment_line_amount_chk", sql`${t.currentAmount} >= 0`),
  ],
);

export const financialContractImportSessionsTable = pgTable(
  "financial_contract_import_sessions",
  {
    id: text("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    companyId: integer("company_id").notNull(),
    actorUserId: integer("actor_user_id").notNull(),
    sourceFileId: integer("source_file_id").notNull(),
    fileHash: text("file_hash").notNull(),
    parsedFingerprint: text("parsed_fingerprint").notNull(),
    currency: text("currency").notNull(),
    total: numeric("total", { precision: 30, scale: 6 }).notNull(),
    acceptedCount: integer("accepted_count").notNull(),
    rejectedCount: integer("rejected_count").notNull(),
    preview: jsonb("preview").notNull(),
    confirmedContractVersionId: text("confirmed_contract_version_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.confirmedContractVersionId],
      foreignColumns: [financialContractVersionsTable.id],
      name: "financial_contract_import_ses_confirmed_contract_version_i_fkey",
    }),
    unique(
      "financial_contract_import_ses_confirmed_contract_version_id_key",
    ).on(t.confirmedContractVersionId),
    unique(
      "financial_contract_import_sessio_project_id_idempotency_key_key",
    ).on(t.projectId, t.idempotencyKey),
    foreignKey({
      columns: [t.projectId],
      foreignColumns: [projectsTable.id],
      name: "financial_contract_import_sessions_project_id_fkey",
    }),
    foreignKey({
      columns: [t.companyId],
      foreignColumns: [companiesTable.id],
      name: "financial_contract_import_sessions_company_id_fkey",
    }),
    foreignKey({
      columns: [t.actorUserId],
      foreignColumns: [usersTable.id],
      name: "financial_contract_import_sessions_actor_user_id_fkey",
    }),
    foreignKey({
      columns: [t.sourceFileId],
      foreignColumns: [filesTable.id],
      name: "financial_contract_import_sessions_source_file_id_fkey",
    }),
  ],
);

export const financialContractRecordGrantsTable = pgTable(
  "financial_contract_record_grants",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id").notNull(),
    userId: integer("user_id").notNull(),
    permission: text("permission").notNull(),
    version: integer("version").notNull(),
    state: text("state").notNull(),
    reason: text("reason").notNull(),
    grantedById: integer("granted_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique(
      "financial_contract_record_gra_contract_id_user_id_permissio_key",
    ).on(t.contractId, t.userId, t.permission, t.version),
    foreignKey({
      columns: [t.contractId],
      foreignColumns: [financialContractsTable.id],
      name: "financial_contract_record_grants_contract_id_fkey",
    }),
    foreignKey({
      columns: [t.userId],
      foreignColumns: [usersTable.id],
      name: "financial_contract_record_grants_user_id_fkey",
    }),
    foreignKey({
      columns: [t.grantedById],
      foreignColumns: [usersTable.id],
      name: "financial_contract_record_grants_granted_by_id_fkey",
    }),
    index("financial_contract_grant_lookup_idx").on(
      t.contractId,
      t.userId,
      t.permission,
      t.version.desc().nullsFirst(),
    ),
    check(
      "financial_contract_record_permission_chk",
      sql`${t.permission} IN ('view','prepare','review','approve','execute','manage')`,
    ),
    check(
      "financial_contract_record_grant_state_chk",
      sql`${t.state} IN ('active','revoked')`,
    ),
  ],
);

export const financialContractHistoryTable = pgTable(
  "financial_contract_history",
  {
    id: text("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    projectId: integer("project_id").notNull(),
    contractId: text("contract_id").notNull(),
    contractVersionId: text("contract_version_id"),
    amendmentId: text("amendment_id"),
    amendmentVersionId: text("amendment_version_id"),
    paymentApplicationId: text("payment_application_id"),
    paymentVersionId: text("payment_version_id"),
    actorUserId: integer("actor_user_id").notNull(),
    eventType: text("event_type").notNull(),
    beforeState: text("before_state"),
    afterState: text("after_state"),
    reasonCode: text("reason_code").notNull(),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.companyId],
      foreignColumns: [companiesTable.id],
      name: "financial_contract_history_company_id_fkey",
    }),
    foreignKey({
      columns: [t.projectId],
      foreignColumns: [projectsTable.id],
      name: "financial_contract_history_project_id_fkey",
    }),
    foreignKey({
      columns: [t.contractId],
      foreignColumns: [financialContractsTable.id],
      name: "financial_contract_history_contract_id_fkey",
    }),
    foreignKey({
      columns: [t.contractVersionId],
      foreignColumns: [financialContractVersionsTable.id],
      name: "financial_contract_history_contract_version_id_fkey",
    }),
    foreignKey({
      columns: [t.amendmentId],
      foreignColumns: [financialContractAmendmentsTable.id],
      name: "financial_contract_history_amendment_id_fkey",
    }),
    foreignKey({
      columns: [t.amendmentVersionId],
      foreignColumns: [financialContractAmendmentVersionsTable.id],
      name: "financial_contract_history_amendment_version_id_fkey",
    }),
    foreignKey({ columns: [t.paymentApplicationId], foreignColumns: [financialContractPaymentApplicationsTable.id], name: "fin_contract_history_payment_app_id_fkey" }),
    foreignKey({ columns: [t.paymentVersionId], foreignColumns: [financialContractPaymentVersionsTable.id], name: "fin_contract_history_payment_version_id_fkey" }),
    foreignKey({
      columns: [t.actorUserId],
      foreignColumns: [usersTable.id],
      name: "financial_contract_history_actor_user_id_fkey",
    }),
    index("financial_contract_history_scope_idx").on(
      t.companyId,
      t.projectId,
      t.contractId,
      t.occurredAt,
    ),
  ],
);
