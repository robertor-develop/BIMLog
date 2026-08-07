import { sql } from "drizzle-orm";
import { boolean, char, check, foreignKey, integer, json, jsonb, pgTable, primaryKey, serial, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";

export const rfisTable = pgTable("rfis", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  number: text("number").notNull(),
  subject: text("subject").notNull(),
  rfiType: text("rfi_type"),
  description: text("description"),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  dueDate: timestamp("due_date"),
  respondedAt: timestamp("responded_at"),
  response: text("response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // New fields v2
  dateRequested: timestamp("date_requested"),
  dateRequired: timestamp("date_required"),

  submittedByCompany: text("submitted_by_company"),
  submittedByContact: text("submitted_by_contact"),
  submittedByAddress: text("submitted_by_address"),
  submittedByPhone: text("submitted_by_phone"),
  submittedByEmail: text("submitted_by_email"),

  submittedToCompany: text("submitted_to_company"),
  submittedToPerson: text("submitted_to_person"),
  submittedToEmail: text("submitted_to_email"),

  drawingNumber: text("drawing_number"),
  drawingTitle: text("drawing_title"),
  specSection: text("spec_section"),
  detailNumber: text("detail_number"),
  noteNumber: text("note_number"),
  locationDescription: text("location_description"),

  question: text("question"),

  costImpact: text("cost_impact"),
  costImpactAmount: text("cost_impact_amount"),
  costImpactReason: text("cost_impact_reason"),
  scheduleImpact: text("schedule_impact"),
  scheduleImpactDays: integer("schedule_impact_days"),
  scheduleImpactReason: text("schedule_impact_reason"),

  answer: text("answer"),
  answeredBy: text("answered_by"),
  dateAnswered: timestamp("date_answered"),

  distributionList: json("distribution_list").$type<string[]>().default([]),
  emailDescription: text("email_description"),
  emailDraft: text("email_draft"),
  attachmentsJson: json("attachments_json").$type<string[]>().default([]),
  attachmentPackageJson: json("attachment_package_json").$type<Array<{
    key: string;
    label: string;
    fileId?: number | null;
    attachment?: string | null;
    source?: string | null;
    include: boolean;
    order: number;
  }>>().default([]),
  imagePresentationJson: json("image_presentation_json").$type<{
    sourceFileId?: number | null;
    replacementFileId?: number | null;
    sourceKind?: "viewpoint" | "upload" | "paste" | "screen-snip" | null;
    replacementKind?: "upload" | "paste" | "screen-snip" | null;
    showInRfi?: boolean;
    includeInCompletePdf?: boolean;
    crop?: { x: number; y: number; width: number; height: number } | null;
    reportScreenshots?: Array<{
      fileId: number;
      kind: "upload" | "paste" | "screen-snip";
      caption?: string | null;
      description?: string | null;
      include?: boolean;
      order: number;
    }>;
  } | null>().default(null),
  responseAttachmentsJson: json("response_attachments_json").$type<string[]>().default([]),

  parentRfiId: integer("parent_rfi_id"),
  revisionNumber: integer("revision_number").default(0),
  revisionOf: integer("revision_of"),

  projectAddress: text("project_address"),

  // RFI send accountability: status is self-reported by the author (manual
  // mark-as-sent via copy/paste). There is no platform email delivery.
  sendStatus: text("send_status").default("draft"),
  sentAt: timestamp("sent_at"),
  sentById: integer("sent_by_id").references(() => usersTable.id),
  sendMethod: text("send_method"),

  ballInCourt: text("ball_in_court"),
  lastOverdueNotificationSent: timestamp("last_overdue_notification_sent"),
  deletedAt: timestamp("deleted_at"),
  deleteReason: text("delete_reason"),

  // Set when an RFI is created from a Navisworks viewpoint via the plugin. Holds
  // the source viewpoint's code so the detail panel can deep-link back to it.
  sourceViewpointId: text("source_viewpoint_id"),
  sourceViewpointLabel: text("source_viewpoint_label"),

  closedAt: timestamp("closed_at"),
  closedById: integer("closed_by_id").references(() => usersTable.id),
  reopenedAt: timestamp("reopened_at"),
  reopenedById: integer("reopened_by_id").references(() => usersTable.id),
}, (t) => ({
  revisionFamilyNumberUnique: uniqueIndex("rfis_project_revision_family_number_uidx")
    .on(t.projectId, t.parentRfiId, t.revisionNumber)
    .where(sql`parent_rfi_id IS NOT NULL`),
}));

export type Rfi = typeof rfisTable.$inferSelect;

// A binding is intentionally provisioned outside the customer import flow. Its
// presence is the audited proof that a provider project belongs to this exact
// BIMLog project/company; imports fail closed when it is absent.
export const rfiImportBindingsTable = pgTable("rfi_import_bindings", {
  id: serial("id").notNull(),
  version: integer("version").notNull(),
  auditIdentity: text("audit_identity").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  provider: text("provider").notNull(),
  sourceProjectCode: text("source_project_code").notNull(),
  sourceProjectIdentityDigest: char("source_project_identity_digest", { length: 64 }).notNull(),
  capability: text("capability").notNull(),
  current: boolean("current").default(true).notNull(),
  revokedAt: timestamp("revoked_at"),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: "rfi_import_binding_pk", columns: [table.id, table.version] }),
  unique("rfi_import_binding_capability_uq").on(table.id, table.version, table.capability),
  unique("rfi_import_binding_reference_uq").on(
    table.id, table.version, table.auditIdentity, table.projectId,
    table.provider, table.sourceProjectCode, table.sourceProjectIdentityDigest,
  ),
  unique("rfi_import_binding_identity_version_uq").on(
    table.version, table.projectId, table.companyId, table.provider, table.sourceProjectCode, table.capability,
  ),
  uniqueIndex("rfi_import_single_current_binding_uq").on(
    table.projectId, table.companyId, table.provider, table.sourceProjectCode, table.capability,
  ).where(sql`${table.current} = true and ${table.revokedAt} is null`),
  check("rfi_import_binding_version_positive", sql`${table.version} > 0`),
  check("rfi_import_binding_digest_format", sql`${table.sourceProjectIdentityDigest} ~ '^[0-9a-f]{64}$'`),
  check("rfi_import_binding_audit_identity_bounded", sql`octet_length(${table.auditIdentity}) between 1 and 256`),
  check("rfi_import_binding_source_project_bounded", sql`octet_length(${table.sourceProjectCode}) between 1 and 128`),
  check("rfi_import_binding_provider_bounded", sql`octet_length(${table.provider}) between 1 and 64`),
  check("rfi_import_binding_capability_rfi_import", sql`${table.capability} = 'RFI_IMPORT'`),
  check("rfi_import_binding_lifecycle_chk", sql`(${table.current} = true and ${table.revokedAt} is null) or (${table.current} = false and ${table.revokedAt} is not null)`),
]);

export const rfiImportAuthorizationsTable = pgTable("rfi_import_authorizations", {
  id: serial("id").primaryKey(),
  bindingId: integer("binding_id").notNull(),
  bindingVersion: integer("binding_version").notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  capability: text("capability").notNull(),
  current: boolean("current").default(true).notNull(),
  revokedAt: timestamp("revoked_at"),
  grantedById: integer("granted_by_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    name: "rfi_import_authorization_binding_fk",
    columns: [table.bindingId, table.bindingVersion, table.capability],
    foreignColumns: [rfiImportBindingsTable.id, rfiImportBindingsTable.version, rfiImportBindingsTable.capability],
  }),
  uniqueIndex("rfi_import_single_current_authorization_uq").on(
    table.bindingId, table.bindingVersion, table.userId, table.capability,
  ).where(sql`${table.current} = true and ${table.revokedAt} is null`),
  check("rfi_import_authorization_binding_version_positive", sql`${table.bindingVersion} > 0`),
  check("rfi_import_authorization_capability_rfi_import", sql`${table.capability} = 'RFI_IMPORT'`),
  check("rfi_import_authorization_lifecycle_chk", sql`(${table.current} = true and ${table.revokedAt} is null) or (${table.current} = false and ${table.revokedAt} is not null)`),
]);

export const rfiImportsTable = pgTable("rfi_imports", {
  id: serial("id").primaryKey(),
  // Keep composite-identity columns in the same physical order as their
  // referenced columns. Replit's publisher serializes composite foreign keys
  // by table ordinal, so this ordering prevents it from changing the mapping.
  bindingId: integer("binding_id").notNull(),
  bindingVersion: integer("binding_version").notNull(),
  bindingAuditIdentity: text("binding_audit_identity").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  provider: text("provider").notNull(),
  sourceProjectCode: text("source_project_code").notNull(),
  sourceProjectIdentityDigest: char("source_project_identity_digest", { length: 64 }).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  sourceDigest: char("source_digest", { length: 64 }).notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id).notNull(),
  rowCount: integer("row_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    name: "rfi_import_binding_identity_fk",
    columns: [
      table.bindingId, table.bindingVersion, table.bindingAuditIdentity, table.projectId,
      table.provider, table.sourceProjectCode, table.sourceProjectIdentityDigest,
    ],
    foreignColumns: [
      rfiImportBindingsTable.id, rfiImportBindingsTable.version, rfiImportBindingsTable.auditIdentity,
      rfiImportBindingsTable.projectId, rfiImportBindingsTable.provider,
      rfiImportBindingsTable.sourceProjectCode, rfiImportBindingsTable.sourceProjectIdentityDigest,
    ],
  }),
  unique("rfi_import_composite_identity_uq").on(
    table.id, table.bindingId, table.bindingVersion, table.projectId, table.provider, table.sourceProjectCode,
  ),
  unique("rfi_import_replay_uq").on(table.projectId, table.provider, table.sourceProjectCode, table.idempotencyKey),
  check("rfi_import_row_count_positive", sql`${table.rowCount} > 0`),
  check("rfi_import_binding_version_positive", sql`${table.bindingVersion} > 0`),
  check("rfi_import_source_digest_format", sql`${table.sourceDigest} ~ '^[0-9a-f]{64}$'`),
  check("rfi_import_project_digest_format", sql`${table.sourceProjectIdentityDigest} ~ '^[0-9a-f]{64}$'`),
  check("rfi_import_idempotency_key_bounded", sql`octet_length(${table.idempotencyKey}) between 1 and 128`),
  check("rfi_import_idempotency_key_format", sql`${table.idempotencyKey} ~ '^[A-Za-z0-9._:-]+$'`),
  check("rfi_import_source_project_bounded", sql`octet_length(${table.sourceProjectCode}) between 1 and 128`),
  check("rfi_import_provider_bounded", sql`octet_length(${table.provider}) between 1 and 64`),
]);

export const rfiImportRowsTable = pgTable("rfi_import_rows", {
  id: serial("id").primaryKey(),
  importId: integer("import_id").notNull(),
  // Mirror the selected parent-column ordinal so managed migration generators
  // cannot silently pair integer identifiers with provider/source text.
  bindingId: integer("binding_id").notNull(),
  bindingVersion: integer("binding_version").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  provider: text("provider").notNull(),
  sourceProjectCode: text("source_project_code").notNull(),
  sourceNumber: text("source_number").notNull(),
  sourceRevision: integer("source_revision").notNull(),
  sourcePayload: jsonb("source_payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  foreignKey({
    name: "rfi_import_row_composite_fk",
    columns: [table.importId, table.bindingId, table.bindingVersion, table.projectId, table.provider, table.sourceProjectCode],
    foreignColumns: [
      rfiImportsTable.id, rfiImportsTable.bindingId, rfiImportsTable.bindingVersion,
      rfiImportsTable.projectId, rfiImportsTable.provider, rfiImportsTable.sourceProjectCode,
    ],
  }),
  unique("rfi_import_source_identity_uq").on(
    table.projectId, table.provider, table.sourceProjectCode, table.sourceNumber, table.sourceRevision,
  ),
  check("rfi_import_row_binding_version_positive", sql`${table.bindingVersion} > 0`),
  check("rfi_import_source_revision_nonnegative", sql`${table.sourceRevision} >= 0`),
  check("rfi_import_source_number_bounded", sql`octet_length(${table.sourceNumber}) between 1 and 8192`),
  check("rfi_import_source_payload_bounded", sql`octet_length(${table.sourcePayload}::text) <= 65536`),
  check("rfi_import_row_source_project_bounded", sql`octet_length(${table.sourceProjectCode}) between 1 and 128`),
  check("rfi_import_row_provider_bounded", sql`octet_length(${table.provider}) between 1 and 64`),
]);
