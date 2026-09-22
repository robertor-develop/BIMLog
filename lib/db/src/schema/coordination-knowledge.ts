import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { filesTable } from "./files";
import { lensViewpointsTable } from "./lens-viewpoints";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";

const utc = (name: string) => timestamp(name, { withTimezone: true });
export const coordinationConflictTypesTable = pgTable("coordination_conflict_types", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  code: text("code").notNull(),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: utc("created_at").notNull().defaultNow(),
  updatedAt: utc("updated_at").notNull().defaultNow(),
}, t => [
  unique("coord_conflict_types_company_code_uq").on(t.companyId, t.code),
  unique("coord_conflict_types_id_company_uq").on(t.id, t.companyId),
  check("coord_conflict_types_code_chk", sql`${t.code} ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'`),
]);

export const coordinationConflictTypeRevisionsTable = pgTable("coordination_conflict_type_revisions", {
  id: text("id").primaryKey(),
  conflictTypeId: text("conflict_type_id").notNull(),
  companyId: integer("company_id").notNull(),
  revision: integer("revision").notNull(),
  status: text("status").notNull().default("draft"),
  name: text("name").notNull(),
  description: text("description").notNull(),
  disciplineA: text("discipline_a").notNull(),
  disciplineB: text("discipline_b").notNull(),
  elementTypeA: text("element_type_a").notNull(),
  elementTypeB: text("element_type_b").notNull(),
  conflictCategory: text("conflict_category").notNull(),
  coordinationStage: text("coordination_stage").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  authoredById: integer("authored_by_id").notNull().references(() => usersTable.id),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvedAt: utc("approved_at"),
  retiredById: integer("retired_by_id").references(() => usersTable.id),
  retiredAt: utc("retired_at"),
  createdAt: utc("created_at").notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.conflictTypeId, t.companyId], foreignColumns: [coordinationConflictTypesTable.id, coordinationConflictTypesTable.companyId], name: "coord_conflict_type_revision_scope_fk" }),
  unique("coord_conflict_type_revision_uq").on(t.conflictTypeId, t.revision),
  unique("coord_conflict_type_revision_scope_uq").on(t.id, t.companyId),
  index("coord_conflict_type_status_idx").on(t.companyId, t.status, t.conflictTypeId),
  check("coord_conflict_type_revision_positive_chk", sql`${t.revision} > 0`),
  check("coord_conflict_type_status_chk", sql`${t.status} IN ('draft','under_review','approved','retired')`),
  check("coord_conflict_type_tags_chk", sql`jsonb_typeof(${t.tags}) = 'array'`),
  check("coord_conflict_type_approval_chk", sql`(${t.status} IN ('approved','retired')) = (${t.approvedById} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`),
  check("coord_conflict_type_retirement_chk", sql`(${t.status} = 'retired') = (${t.retiredById} IS NOT NULL AND ${t.retiredAt} IS NOT NULL)`),
]);

export const coordinationRulesTable = pgTable("coordination_rules", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  code: text("code").notNull(),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: utc("created_at").notNull().defaultNow(),
  updatedAt: utc("updated_at").notNull().defaultNow(),
}, t => [
  unique("coord_rules_company_code_uq").on(t.companyId, t.code),
  unique("coord_rules_id_company_uq").on(t.id, t.companyId),
  check("coord_rules_code_chk", sql`${t.code} ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'`),
]);

export const coordinationRuleRevisionsTable = pgTable("coordination_rule_revisions", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id").notNull(),
  companyId: integer("company_id").notNull(),
  revision: integer("revision").notNull(),
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  guidance: text("guidance").notNull(),
  applicability: jsonb("applicability").$type<Record<string, unknown>>().notNull().default({}),
  rationale: text("rationale").notNull(),
  exceptions: jsonb("exceptions").$type<string[]>().notNull().default([]),
  references: jsonb("references").$type<Array<Record<string, unknown>>>().notNull().default([]),
  authoredById: integer("authored_by_id").notNull().references(() => usersTable.id),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvedAt: utc("approved_at"),
  retiredById: integer("retired_by_id").references(() => usersTable.id),
  retiredAt: utc("retired_at"),
  createdAt: utc("created_at").notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.ruleId, t.companyId], foreignColumns: [coordinationRulesTable.id, coordinationRulesTable.companyId], name: "coord_rule_revision_scope_fk" }),
  unique("coord_rule_revision_uq").on(t.ruleId, t.revision),
  unique("coord_rule_revision_scope_uq").on(t.id, t.companyId),
  index("coord_rule_status_idx").on(t.companyId, t.status, t.ruleId),
  check("coord_rule_revision_positive_chk", sql`${t.revision} > 0`),
  check("coord_rule_status_chk", sql`${t.status} IN ('draft','under_review','approved','retired')`),
  check("coord_rule_applicability_chk", sql`jsonb_typeof(${t.applicability}) = 'object'`),
  check("coord_rule_exceptions_chk", sql`jsonb_typeof(${t.exceptions}) = 'array'`),
  check("coord_rule_references_chk", sql`jsonb_typeof(${t.references}) = 'array'`),
  check("coord_rule_approval_chk", sql`(${t.status} IN ('approved','retired')) = (${t.approvedById} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`),
  check("coord_rule_retirement_chk", sql`(${t.status} = 'retired') = (${t.retiredById} IS NOT NULL AND ${t.retiredAt} IS NOT NULL)`),
]);

export const coordinationResolutionMethodsTable = pgTable("coordination_resolution_methods", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  code: text("code").notNull(),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: utc("created_at").notNull().defaultNow(),
  updatedAt: utc("updated_at").notNull().defaultNow(),
}, t => [
  unique("coord_resolution_methods_company_code_uq").on(t.companyId, t.code),
  unique("coord_resolution_methods_id_company_uq").on(t.id, t.companyId),
  check("coord_resolution_methods_code_chk", sql`${t.code} ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'`),
]);

export const coordinationResolutionMethodRevisionsTable = pgTable("coordination_resolution_method_revisions", {
  id: text("id").primaryKey(),
  resolutionMethodId: text("resolution_method_id").notNull(),
  companyId: integer("company_id").notNull(),
  revision: integer("revision").notNull(),
  status: text("status").notNull().default("draft"),
  name: text("name").notNull(),
  description: text("description").notNull(),
  applicability: jsonb("applicability").$type<Record<string, unknown>>().notNull().default({}),
  responsibleTrade: text("responsible_trade"),
  constraints: jsonb("constraints").$type<string[]>().notNull().default([]),
  advantages: jsonb("advantages").$type<string[]>().notNull().default([]),
  disadvantages: jsonb("disadvantages").$type<string[]>().notNull().default([]),
  requiredApprovals: jsonb("required_approvals").$type<string[]>().notNull().default([]),
  rfiRequirement: text("rfi_requirement").notNull().default("conditional"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  authoredById: integer("authored_by_id").notNull().references(() => usersTable.id),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  approvedAt: utc("approved_at"),
  retiredById: integer("retired_by_id").references(() => usersTable.id),
  retiredAt: utc("retired_at"),
  createdAt: utc("created_at").notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.resolutionMethodId, t.companyId], foreignColumns: [coordinationResolutionMethodsTable.id, coordinationResolutionMethodsTable.companyId], name: "coord_resolution_revision_scope_fk" }),
  unique("coord_resolution_method_revision_uq").on(t.resolutionMethodId, t.revision),
  unique("coord_resolution_revision_scope_uq").on(t.id, t.companyId),
  index("coord_resolution_method_status_idx").on(t.companyId, t.status, t.resolutionMethodId),
  check("coord_resolution_revision_positive_chk", sql`${t.revision} > 0`),
  check("coord_resolution_method_status_chk", sql`${t.status} IN ('draft','under_review','approved','retired')`),
  check("coord_resolution_method_rfi_chk", sql`${t.rfiRequirement} IN ('never','conditional','required')`),
  check("coord_resolution_method_applicability_chk", sql`jsonb_typeof(${t.applicability}) = 'object'`),
  check("coord_resolution_method_constraints_chk", sql`jsonb_typeof(${t.constraints}) = 'array'`),
  check("coord_resolution_method_advantages_chk", sql`jsonb_typeof(${t.advantages}) = 'array'`),
  check("coord_resolution_method_disadvantages_chk", sql`jsonb_typeof(${t.disadvantages}) = 'array'`),
  check("coord_resolution_method_approvals_chk", sql`jsonb_typeof(${t.requiredApprovals}) = 'array'`),
  check("coord_resolution_method_details_chk", sql`jsonb_typeof(${t.details}) = 'object'`),
  check("coord_resolution_method_approval_chk", sql`(${t.status} IN ('approved','retired')) = (${t.approvedById} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`),
  check("coord_resolution_method_retirement_chk", sql`(${t.status} = 'retired') = (${t.retiredById} IS NOT NULL AND ${t.retiredAt} IS NOT NULL)`),
]);

export const coordinationResolutionMethodConflictTypesTable = pgTable("coordination_resolution_method_conflict_types", {
  companyId: integer("company_id").notNull(),
  resolutionMethodRevisionId: text("resolution_method_revision_id").notNull(),
  conflictTypeId: text("conflict_type_id").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  linkedById: integer("linked_by_id").notNull().references(() => usersTable.id),
  linkedAt: utc("linked_at").notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.resolutionMethodRevisionId, t.conflictTypeId], name: "coord_resolution_method_conflict_types_pk" }),
  foreignKey({ columns: [t.resolutionMethodRevisionId, t.companyId], foreignColumns: [coordinationResolutionMethodRevisionsTable.id, coordinationResolutionMethodRevisionsTable.companyId], name: "coord_resolution_method_revision_scope_fk" }),
  foreignKey({ columns: [t.conflictTypeId, t.companyId], foreignColumns: [coordinationConflictTypesTable.id, coordinationConflictTypesTable.companyId], name: "coord_resolution_conflict_type_scope_fk" }),
  check("coord_resolution_display_order_chk", sql`${t.displayOrder} >= 0`),
]);

export const coordinationResolutionMethodRulesTable = pgTable("coordination_resolution_method_rules", {
  companyId: integer("company_id").notNull(),
  resolutionMethodRevisionId: text("resolution_method_revision_id").notNull(),
  ruleRevisionId: text("rule_revision_id").notNull(),
  linkedById: integer("linked_by_id").notNull().references(() => usersTable.id),
  linkedAt: utc("linked_at").notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.resolutionMethodRevisionId, t.ruleRevisionId], name: "coord_resolution_method_rules_pk" }),
  foreignKey({ columns: [t.resolutionMethodRevisionId, t.companyId], foreignColumns: [coordinationResolutionMethodRevisionsTable.id, coordinationResolutionMethodRevisionsTable.companyId], name: "coord_resolution_method_rule_method_fk" }),
  foreignKey({ columns: [t.ruleRevisionId, t.companyId], foreignColumns: [coordinationRuleRevisionsTable.id, coordinationRuleRevisionsTable.companyId], name: "coord_resolution_method_rule_scope_fk" }),
]);

export const coordinationProjectCasesTable = pgTable("coordination_project_cases", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  lensViewpointId: integer("lens_viewpoint_id").notNull().references(() => lensViewpointsTable.id),
  conflictTypeRevisionId: text("conflict_type_revision_id"),
  resolutionMethodRevisionId: text("resolution_method_revision_id"),
  status: text("status").notNull().default("open"),
  decision: text("decision"),
  actualResolution: text("actual_resolution"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  resolvedById: integer("resolved_by_id").references(() => usersTable.id),
  resolvedAt: utc("resolved_at"),
  verifiedById: integer("verified_by_id").references(() => usersTable.id),
  verifiedAt: utc("verified_at"),
  createdAt: utc("created_at").notNull().defaultNow(),
  updatedAt: utc("updated_at").notNull().defaultNow(),
}, t => [
  unique("coord_project_case_issue_uq").on(t.companyId, t.projectId, t.lensViewpointId),
  unique("coord_project_case_scope_uq").on(t.id, t.companyId, t.projectId),
  foreignKey({ columns: [t.conflictTypeRevisionId, t.companyId], foreignColumns: [coordinationConflictTypeRevisionsTable.id, coordinationConflictTypeRevisionsTable.companyId], name: "coord_project_case_conflict_revision_fk" }),
  foreignKey({ columns: [t.resolutionMethodRevisionId, t.companyId], foreignColumns: [coordinationResolutionMethodRevisionsTable.id, coordinationResolutionMethodRevisionsTable.companyId], name: "coord_project_case_resolution_revision_fk" }),
  index("coord_project_cases_project_status_idx").on(t.companyId, t.projectId, t.status),
  check("coord_project_case_status_chk", sql`${t.status} IN ('open','resolved','verified')`),
  check("coord_project_case_resolved_chk", sql`(${t.status} IN ('resolved','verified')) = (${t.resolvedById} IS NOT NULL AND ${t.resolvedAt} IS NOT NULL AND ${t.actualResolution} IS NOT NULL)`),
  check("coord_project_case_verified_chk", sql`(${t.status} = 'verified') = (${t.verifiedById} IS NOT NULL AND ${t.verifiedAt} IS NOT NULL)`),
]);

export const coordinationResolutionRecordsTable = pgTable("coordination_resolution_records", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  projectCaseId: text("project_case_id").notNull(),
  lensViewpointId: integer("lens_viewpoint_id").notNull().references(() => lensViewpointsTable.id),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: utc("created_at").notNull().defaultNow(),
  updatedAt: utc("updated_at").notNull().defaultNow(),
}, t => [
  foreignKey({ columns: [t.projectCaseId,t.companyId,t.projectId], foreignColumns: [coordinationProjectCasesTable.id,coordinationProjectCasesTable.companyId,coordinationProjectCasesTable.projectId], name: "coord_resolution_record_case_scope_fk" }),
  unique("coord_resolution_record_case_uq").on(t.companyId,t.projectId,t.projectCaseId),
  unique("coord_resolution_record_issue_uq").on(t.companyId,t.projectId,t.lensViewpointId),
  unique("coord_resolution_record_scope_uq").on(t.id,t.companyId,t.projectId),
]);

export const coordinationResolutionRecordRevisionsTable = pgTable("coordination_resolution_record_revisions", {
  id:text("id").primaryKey(),resolutionRecordId:text("resolution_record_id").notNull(),projectCaseId:text("project_case_id").notNull(),
  companyId:integer("company_id").notNull(),projectId:integer("project_id").notNull(),lensViewpointId:integer("lens_viewpoint_id").notNull(),
  revision:integer("revision").notNull(),status:text("status").notNull().default("draft"),methodRevisionId:text("method_revision_id"),actualResolution:text("actual_resolution"),
  disciplineChanged:text("discipline_changed"),responsibleTrade:text("responsible_trade"),rfiRequired:boolean("rfi_required").notNull().default(false),rfiReference:text("rfi_reference"),drawingSubmittalReference:text("drawing_submittal_reference"),
  resolvedById:integer("resolved_by_id").references(()=>usersTable.id),resolutionDate:utc("resolution_date"),verifiedById:integer("verified_by_id").references(()=>usersTable.id),verificationDate:utc("verification_date"),reopenReason:text("reopen_reason"),createdById:integer("created_by_id").notNull().references(()=>usersTable.id),createdAt:utc("created_at").notNull().defaultNow(),
},t=>[
  foreignKey({columns:[t.resolutionRecordId,t.companyId,t.projectId],foreignColumns:[coordinationResolutionRecordsTable.id,coordinationResolutionRecordsTable.companyId,coordinationResolutionRecordsTable.projectId],name:"coord_resolution_record_revision_scope_fk"}),
  foreignKey({columns:[t.projectCaseId,t.companyId,t.projectId],foreignColumns:[coordinationProjectCasesTable.id,coordinationProjectCasesTable.companyId,coordinationProjectCasesTable.projectId],name:"coord_resolution_record_revision_case_fk"}),
  foreignKey({columns:[t.methodRevisionId,t.companyId],foreignColumns:[coordinationResolutionMethodRevisionsTable.id,coordinationResolutionMethodRevisionsTable.companyId],name:"coord_resolution_record_revision_method_fk"}),
  unique("coord_resolution_record_revision_uq").on(t.resolutionRecordId,t.revision),unique("coord_resolution_record_revision_scope_uq").on(t.id,t.companyId,t.projectId),
  index("coord_resolution_record_history_idx").on(t.companyId,t.projectId,t.lensViewpointId,t.revision),
  check("coord_resolution_record_revision_positive_chk",sql`${t.revision} > 0`),check("coord_resolution_record_status_chk",sql`${t.status} IN ('draft','completed','verified')`),
  check("coord_resolution_record_rfi_chk",sql`NOT ${t.rfiRequired} OR ${t.rfiReference} IS NOT NULL`),check("coord_resolution_record_completed_chk",sql`${t.status} = 'draft' OR (${t.actualResolution} IS NOT NULL AND ${t.resolvedById} IS NOT NULL AND ${t.resolutionDate} IS NOT NULL)`),check("coord_resolution_record_verified_chk",sql`(${t.status} = 'verified') = (${t.verifiedById} IS NOT NULL AND ${t.verificationDate} IS NOT NULL)`),
]);

export const coordinationLessonProposalsTable = pgTable("coordination_lesson_proposals", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  projectId: integer("project_id").notNull(),
  projectCaseId: text("project_case_id").notNull(),
  status: text("status").notNull().default("proposed"),
  proposal: text("proposal").notNull(),
  proposedById: integer("proposed_by_id").notNull().references(() => usersTable.id),
  proposedAt: utc("proposed_at").notNull().defaultNow(),
  reviewedById: integer("reviewed_by_id").references(() => usersTable.id),
  reviewedAt: utc("reviewed_at"),
  reviewRationale: text("review_rationale"),
  promotedEntityType: text("promoted_entity_type"),
  promotedEntityId: text("promoted_entity_id"),
}, t => [
  foreignKey({ columns: [t.projectCaseId, t.companyId, t.projectId], foreignColumns: [coordinationProjectCasesTable.id, coordinationProjectCasesTable.companyId, coordinationProjectCasesTable.projectId], name: "coord_lesson_proposal_case_scope_fk" }),
  unique("coord_lesson_proposal_case_uq").on(t.projectCaseId),
  index("coord_lesson_proposal_queue_idx").on(t.companyId, t.status, t.proposedAt),
  check("coord_lesson_proposal_status_chk", sql`${t.status} IN ('proposed','under_review','approved','rejected','merged')`),
  check("coord_lesson_review_chk", sql`(${t.status} IN ('approved','rejected','merged')) = (${t.reviewedById} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL AND ${t.reviewRationale} IS NOT NULL)`),
  check("coord_lesson_promotion_pair_chk", sql`(${t.promotedEntityType} IS NULL) = (${t.promotedEntityId} IS NULL)`),
  check("coord_lesson_merge_target_chk", sql`${t.status} <> 'merged' OR ${t.promotedEntityId} IS NOT NULL`),
]);

export const coordinationKnowledgeEvidenceTable = pgTable("coordination_knowledge_evidence", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  revisionId: text("revision_id"),
  fileId: integer("file_id").notNull().references(() => filesTable.id),
  evidenceRole: text("evidence_role").notNull(),
  metadata: jsonb("metadata").$type<Record<string,unknown>>().notNull().default({}),
  modelViewReference: jsonb("model_view_reference").$type<Record<string,unknown>>().notNull().default({}),
  addedById: integer("added_by_id").notNull().references(() => usersTable.id),
  addedAt: utc("added_at").notNull().defaultNow(),
}, t => [
  unique("coord_knowledge_evidence_link_uq").on(t.companyId, t.entityType, t.entityId, t.fileId, t.evidenceRole),
  index("coord_knowledge_evidence_entity_idx").on(t.companyId, t.entityType, t.entityId, t.addedAt),
  check("coord_knowledge_evidence_entity_chk", sql`${t.entityType} IN ('conflict_type','coordination_rule','resolution_method','project_case','lesson_proposal')`),
  check("coord_knowledge_evidence_role_chk", sql`${t.evidenceRole} IN ('attachment','reference','before','after','supporting')`),
]);

export const coordinationKnowledgeEventsTable = pgTable("coordination_knowledge_events", {
  id: text("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  revisionId: text("revision_id"),
  action: text("action").notNull(),
  actorId: integer("actor_id").notNull().references(() => usersTable.id),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: utc("created_at").notNull().defaultNow(),
}, t => [
  index("coord_knowledge_events_history_idx").on(t.companyId, t.entityType, t.entityId, t.createdAt),
  check("coord_knowledge_events_details_chk", sql`jsonb_typeof(${t.details}) = 'object'`),
]);
