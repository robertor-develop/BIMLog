import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  bigserial,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  bigint,
  boolean,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { companiesTable, usersTable } from "./users";
import { projectsTable } from "./projects";

export const feedbackItemsTable = pgTable(
  "feedback_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    feedbackType: text("feedback_type").notNull(),
    priority: text("priority").default("normal").notNull(),
    module: text("module"),
    pageUrl: text("page_url").notNull(),
    message: text("message").notNull(),
    status: text("status").default("open").notNull(),
    stableId: text("stable_id").notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    ownerUserId: integer("owner_user_id").references(() => usersTable.id),
    targetRelease: text("target_release"),
    dispositionReason: text("disposition_reason"),
    customerVisible: boolean("customer_visible").default(true).notNull(),
    version: integer("version").default(1).notNull(),
    idempotencyKey: text("idempotency_key"),
    requestHash: text("request_hash"),
    transcript: text("transcript"),
    transcriptProvenance: text("transcript_provenance"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    statusCreatedIdx: index("feedback_items_status_created_idx").on(
      table.status,
      table.createdAt.desc(),
    ),
    userCreatedIdx: index("feedback_items_user_created_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    projectCreatedIdx: index("feedback_items_project_created_idx").on(
      table.projectId,
      table.createdAt.desc(),
    ),
    stableIdIdx: uniqueIndex("feedback_items_stable_id_idx").on(table.stableId),
    idempotencyIdx: uniqueIndex("feedback_items_user_idempotency_idx").on(
      table.userId,
      table.idempotencyKey,
    ),
    statusCheck: check(
      "feedback_items_status_chk",
      sql`${table.status} IN ('new','triaged','accepted','in_progress','blocked','fixed','verified','rejected','deferred')`,
    ),
    versionCheck: check(
      "feedback_items_version_chk",
      sql`${table.version} > 0`,
    ),
  }),
);

export const feedbackAssetsTable = pgTable(
  "feedback_assets",
  {
    id: serial("id").primaryKey(),
    feedbackId: integer("feedback_id")
      .references(() => feedbackItemsTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    uploadedById: integer("uploaded_by_id")
      .references(() => usersTable.id)
      .notNull(),
    kind: text("kind").notNull(),
    originalName: text("original_name").notNull(),
    safeName: text("safe_name").notNull(),
    mediaType: text("media_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    storagePath: text("storage_path").notNull(),
    scanState: text("scan_state").default("quarantined").notNull(),
    scannerAdapter: text("scanner_adapter").default("default-deny").notNull(),
    scannedAt: timestamp("scanned_at"),
    retentionHold: boolean("retention_hold").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    feedbackIdx: index("feedback_assets_feedback_idx").on(
      table.feedbackId,
      table.createdAt,
    ),
    dedupIdx: uniqueIndex("feedback_assets_feedback_hash_idx").on(
      table.feedbackId,
      table.sha256,
    ),
    scanStateCheck: check(
      "feedback_assets_scan_state_chk",
      sql`${table.scanState} IN ('quarantined','clean','rejected')`,
    ),
  }),
);

export const feedbackAuditEventsTable = pgTable(
  "feedback_audit_events",
  {
    id: serial("id").primaryKey(),
    feedbackId: integer("feedback_id")
      .references(() => feedbackItemsTable.id)
      .notNull(),
    actorUserId: integer("actor_user_id")
      .references(() => usersTable.id)
      .notNull(),
    eventType: text("event_type").notNull(),
    beforeState: jsonb("before_state").$type<Record<string, unknown>>(),
    afterState: jsonb("after_state").$type<Record<string, unknown>>(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    feedbackIdx: index("feedback_audit_feedback_idx").on(
      table.feedbackId,
      table.createdAt,
    ),
  }),
);

export const feedbackCaptureConsentsTable = pgTable(
  "feedback_capture_consents",
  {
    id: text("id").primaryKey(),
    actorUserId: integer("actor_user_id")
      .references(() => usersTable.id)
      .notNull(),
    feedbackId: integer("feedback_id").references(() => feedbackItemsTable.id),
    captureKind: text("capture_kind").notNull(),
    purpose: text("purpose").notNull(),
    noticeVersion: text("notice_version").notNull(),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => ({
    actorIdx: index("feedback_capture_consents_actor_idx").on(
      table.actorUserId,
      table.grantedAt,
    ),
  }),
);

export const feedbackTranscriptionJobsTable = pgTable(
  "feedback_transcription_jobs",
  {
    id: serial("id").primaryKey(),
    feedbackId: integer("feedback_id")
      .references(() => feedbackItemsTable.id)
      .notNull(),
    assetId: integer("asset_id")
      .references(() => feedbackAssetsTable.id)
      .notNull(),
    requestedById: integer("requested_by_id")
      .references(() => usersTable.id)
      .notNull(),
    state: text("state").default("queued").notNull(),
    adapter: text("adapter").notNull(),
    result: text("result"),
    errorCode: text("error_code"),
    attempts: integer("attempts").default(0).notNull(),
    requestKey: text("request_key").notNull(),
    requestHash: text("request_hash").notNull(),
    consentId: text("consent_id")
      .references(() => feedbackCaptureConsentsTable.id)
      .notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    adapterVersion: text("adapter_version").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    outputSha256: text("output_sha256"),
    completedAt: timestamp("completed_at"),
    reviewState: text("review_state").default("pending").notNull(),
    reviewedById: integer("reviewed_by_id").references(() => usersTable.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewReason: text("review_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    feedbackIdx: index("feedback_transcription_feedback_idx").on(
      table.feedbackId,
      table.createdAt,
    ),
    requestIdx: uniqueIndex("feedback_transcription_request_idx").on(
      table.requestedById,
      table.requestKey,
    ),
  }),
);

export type FeedbackItem = typeof feedbackItemsTable.$inferSelect;

export const feedbackRelayJobsTable = pgTable(
  "feedback_relay_jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    feedbackId: integer("feedback_id")
      .references(() => feedbackItemsTable.id)
      .notNull(),
    assetId: integer("asset_id")
      .references(() => feedbackAssetsTable.id)
      .notNull(),
    companyId: integer("company_id")
      .references(() => companiesTable.id)
      .notNull(),
    projectId: integer("project_id").references(() => projectsTable.id),
    state: text("state").default("queued").notNull(),
    version: integer("version").default(1).notNull(),
    destinationId: text("destination_id").notNull(),
    objectId: text("object_id").notNull(),
    policyId: text("policy_id").notNull(),
    policyVersion: text("policy_version").notNull(),
    policySha256: text("policy_sha256").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at"),
    leaseOwner: text("lease_owner"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    fencingToken: bigint("fencing_token", { mode: "number" })
      .default(0)
      .notNull(),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    assetDestinationIdx: uniqueIndex(
      "feedback_relay_jobs_asset_destination_idx",
    ).on(table.assetId, table.destinationId),
    objectDestinationIdx: uniqueIndex(
      "feedback_relay_jobs_object_destination_idx",
    ).on(table.destinationId, table.objectId),
    claimIdx: index("feedback_relay_jobs_claim_idx").on(
      table.state,
      table.nextAttemptAt,
      table.leaseExpiresAt,
      table.id,
    ),
    scopeIdx: index("feedback_relay_jobs_scope_idx").on(
      table.companyId,
      table.projectId,
      table.createdAt.desc(),
    ),
    stateCheck: check(
      "feedback_relay_jobs_state_chk",
      sql`${table.state} IN ('queued','transferring','delivered','cleanup-pending','manual-review','held','expired')`,
    ),
    versionCheck: check(
      "feedback_relay_jobs_version_chk",
      sql`${table.version} > 0`,
    ),
    attemptsCheck: check(
      "feedback_relay_jobs_attempts_chk",
      sql`${table.attempts} >= 0`,
    ),
    fencingCheck: check(
      "feedback_relay_jobs_fencing_chk",
      sql`${table.fencingToken} >= 0`,
    ),
    policyHashCheck: check(
      "feedback_relay_jobs_policy_hash_chk",
      sql`${table.policySha256} ~ '^[a-f0-9]{64}$'`,
    ),
    leaseCheck: check(
      "feedback_relay_jobs_lease_chk",
      sql`(${table.leaseOwner} IS NULL AND ${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL) OR (${table.leaseOwner} IS NOT NULL AND ${table.leaseToken} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)`,
    ),
  }),
);

export const feedbackRelayCustodyEventsTable = pgTable(
  "feedback_relay_custody_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: bigint("job_id", { mode: "number" })
      .references(() => feedbackRelayJobsTable.id)
      .notNull(),
    sequence: integer("sequence").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    jobVersion: integer("job_version").notNull(),
    fencingToken: bigint("fencing_token", { mode: "number" }).notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    reasonCode: text("reason_code"),
    metadata: jsonb("metadata").default({}).notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => ({
    sequenceIdx: uniqueIndex("feedback_relay_custody_job_sequence_idx").on(
      table.jobId,
      table.sequence,
    ),
    eventIdx: uniqueIndex("feedback_relay_custody_event_id_idx").on(
      table.eventId,
    ),
    timeIdx: index("feedback_relay_custody_job_time_idx").on(
      table.jobId,
      table.occurredAt,
      table.id,
    ),
    sequenceCheck: check(
      "feedback_relay_custody_sequence_chk",
      sql`${table.sequence}>0`,
    ),
    versionCheck: check(
      "feedback_relay_custody_version_chk",
      sql`${table.jobVersion}>0`,
    ),
    fencingCheck: check(
      "feedback_relay_custody_fencing_chk",
      sql`${table.fencingToken}>=0`,
    ),
    toStateCheck: check(
      "feedback_relay_custody_to_state_chk",
      sql`${table.toState} IN ('queued','transferring','delivered','cleanup-pending','manual-review','held','expired')`,
    ),
    fromStateCheck: check(
      "feedback_relay_custody_from_state_chk",
      sql`${table.fromState} IS NULL OR ${table.fromState} IN ('queued','transferring','delivered','cleanup-pending','manual-review','held','expired')`,
    ),
  }),
);

export const feedbackRelayNoncesTable = pgTable(
  "feedback_relay_nonces",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    audience: text("audience").notNull(),
    keyId: text("key_id").notNull(),
    nonce: text("nonce").notNull(),
    requestId: text("request_id").notNull(),
    requestTimestamp: timestamp("request_timestamp").notNull(),
    consumedAt: timestamp("consumed_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    authorityIdx: uniqueIndex("feedback_relay_nonces_authority_idx").on(
      table.audience,
      table.keyId,
      table.nonce,
    ),
    requestIdx: uniqueIndex("feedback_relay_nonces_request_idx").on(
      table.requestId,
    ),
    expiryIdx: index("feedback_relay_nonces_expiry_idx").on(table.expiresAt),
    expiryCheck: check(
      "feedback_relay_nonces_expiry_chk",
      sql`${table.expiresAt}>${table.requestTimestamp}`,
    ),
  }),
);

export const feedbackRelayReceiptsTable = pgTable(
  "feedback_relay_receipts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: bigint("job_id", { mode: "number" })
      .references(() => feedbackRelayJobsTable.id)
      .notNull(),
    protocolVersion: text("protocol_version").notNull(),
    requestId: text("request_id").notNull(),
    requestNonce: text("request_nonce").notNull(),
    destinationId: text("destination_id").notNull(),
    objectId: text("object_id").notNull(),
    byteCount: bigint("byte_count", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    receivedAt: timestamp("received_at").notNull(),
    receiverKeyId: text("receiver_key_id").notNull(),
    canonicalSha256: text("canonical_sha256").notNull(),
    signature: text("signature").notNull(),
    verifiedAt: timestamp("verified_at").notNull(),
    readbackVerifiedAt: timestamp("readback_verified_at"),
    readbackSha256: text("readback_sha256"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: uniqueIndex("feedback_relay_receipts_job_idx").on(table.jobId),
    requestIdx: uniqueIndex("feedback_relay_receipts_request_idx").on(
      table.requestId,
    ),
    objectIdx: uniqueIndex("feedback_relay_receipts_destination_object_idx").on(
      table.destinationId,
      table.objectId,
    ),
    bytesCheck: check(
      "feedback_relay_receipts_bytes_chk",
      sql`${table.byteCount}>=0`,
    ),
    hashCheck: check(
      "feedback_relay_receipts_hash_chk",
      sql`${table.sha256} ~ '^[a-f0-9]{64}$' AND ${table.canonicalSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    readbackCheck: check(
      "feedback_relay_receipts_readback_chk",
      sql`(${table.readbackVerifiedAt} IS NULL AND ${table.readbackSha256} IS NULL) OR (${table.readbackVerifiedAt} IS NOT NULL AND ${table.readbackSha256}=${table.sha256} AND ${table.readbackVerifiedAt}>=${table.verifiedAt})`,
    ),
  }),
);

export const feedbackRelayHoldsTable = pgTable(
  "feedback_relay_holds",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: bigint("job_id", { mode: "number" })
      .references(() => feedbackRelayJobsTable.id)
      .notNull(),
    holdKey: text("hold_key").notNull(),
    reason: text("reason").notNull(),
    placedByUserId: integer("placed_by_user_id").references(
      () => usersTable.id,
    ),
    placedAt: timestamp("placed_at").defaultNow().notNull(),
    releasedByUserId: integer("released_by_user_id").references(
      () => usersTable.id,
    ),
    releasedAt: timestamp("released_at"),
    releaseReason: text("release_reason"),
  },
  (table) => ({
    keyIdx: uniqueIndex("feedback_relay_holds_key_idx").on(
      table.jobId,
      table.holdKey,
    ),
    activeIdx: uniqueIndex("feedback_relay_holds_active_idx")
      .on(table.jobId)
      .where(sql`${table.releasedAt} IS NULL`),
    releaseCheck: check(
      "feedback_relay_holds_release_chk",
      sql`(${table.releasedAt} IS NULL AND ${table.releasedByUserId} IS NULL AND ${table.releaseReason} IS NULL) OR (${table.releasedAt} IS NOT NULL AND ${table.releasedByUserId} IS NOT NULL AND ${table.releaseReason} IS NOT NULL AND ${table.releasedAt}>=${table.placedAt})`,
    ),
  }),
);

export const feedbackRelayTemporaryObjectsTable = pgTable(
  "feedback_relay_temporary_objects",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: bigint("job_id", { mode: "number" })
      .references(() => feedbackRelayJobsTable.id)
      .notNull(),
    storageBackend: text("storage_backend").notNull(),
    storageKey: text("storage_key").notNull(),
    byteCount: bigint("byte_count", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    encrypted: boolean("encrypted").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    deleteStartedAt: timestamp("delete_started_at"),
    deletedAt: timestamp("deleted_at"),
    absenceVerifiedAt: timestamp("absence_verified_at"),
    deleteFencingToken: bigint("delete_fencing_token", { mode: "number" }),
  },
  (table) => ({
    jobIdx: uniqueIndex("feedback_relay_temp_job_idx").on(table.jobId),
    storageIdx: uniqueIndex("feedback_relay_temp_storage_idx").on(
      table.storageBackend,
      table.storageKey,
    ),
    expiryIdx: index("feedback_relay_temp_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.deletedAt} IS NULL`),
    bytesCheck: check(
      "feedback_relay_temp_bytes_chk",
      sql`${table.byteCount}>=0`,
    ),
    hashCheck: check(
      "feedback_relay_temp_hash_chk",
      sql`${table.sha256} ~ '^[a-f0-9]{64}$'`,
    ),
    expiryCheck: check(
      "feedback_relay_temp_expiry_chk",
      sql`${table.expiresAt}>${table.createdAt}`,
    ),
    deleteCheck: check(
      "feedback_relay_temp_delete_chk",
      sql`(${table.deletedAt} IS NULL AND ${table.absenceVerifiedAt} IS NULL) OR (${table.deleteStartedAt} IS NOT NULL AND ${table.deletedAt} IS NOT NULL AND ${table.absenceVerifiedAt} IS NOT NULL AND ${table.deleteFencingToken} IS NOT NULL AND ${table.deleteFencingToken}>=0 AND ${table.deleteStartedAt}<=${table.deletedAt} AND ${table.deletedAt}<=${table.absenceVerifiedAt})`,
    ),
  }),
);

export const feedbackRelayDeletionProofsTable = pgTable(
  "feedback_relay_deletion_proofs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: bigint("job_id", { mode: "number" })
      .references(() => feedbackRelayJobsTable.id)
      .notNull(),
    temporaryObjectId: bigint("temporary_object_id", { mode: "number" })
      .references(() => feedbackRelayTemporaryObjectsTable.id)
      .notNull(),
    receiptId: bigint("receipt_id", { mode: "number" })
      .references(() => feedbackRelayReceiptsTable.id)
      .notNull(),
    approvalId: text("approval_id").notNull(),
    approvedByUserId: integer("approved_by_user_id")
      .references(() => usersTable.id)
      .notNull(),
    inventory: jsonb("inventory").notNull(),
    inventorySha256: text("inventory_sha256").notNull(),
    deletedAt: timestamp("deleted_at").notNull(),
    absenceVerifiedAt: timestamp("absence_verified_at").notNull(),
    proofSha256: text("proof_sha256").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: uniqueIndex("feedback_relay_deletion_job_idx").on(table.jobId),
    tempIdx: uniqueIndex("feedback_relay_deletion_temp_idx").on(
      table.temporaryObjectId,
    ),
    hashCheck: check(
      "feedback_relay_deletion_hash_chk",
      sql`${table.inventorySha256} ~ '^[a-f0-9]{64}$' AND ${table.proofSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    orderCheck: check(
      "feedback_relay_deletion_order_chk",
      sql`${table.deletedAt}<=${table.absenceVerifiedAt} AND ${table.absenceVerifiedAt}<=${table.createdAt}`,
    ),
  }),
);
