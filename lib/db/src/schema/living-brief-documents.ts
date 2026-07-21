import { pgTable, text, timestamp, bigint } from "drizzle-orm/pg-core";

export const livingBriefDocumentsTable = pgTable("living_brief_documents", {
  documentKey: text("document_key").primaryKey(),
  content: text("content").notNull(),
  deployedSourceCommit: text("deployed_source_commit").notNull(),
  reconciledThroughCommit: text("reconciled_through_commit").notNull(),
  sourceSha256: text("source_sha256").notNull(),
  sourceChangedAt: timestamp("source_changed_at", { withTimezone: true }).notNull(),
  mirrorSyncedAt: timestamp("mirror_synced_at", { withTimezone: true }).notNull(),
  synchronizationResult: text("synchronization_result").notNull(),
  mismatchDetectedAt: timestamp("mismatch_detected_at", { withTimezone: true }),
  version: bigint("version", { mode: "number" }).notNull().default(1),
});

export type LivingBriefDocument = typeof livingBriefDocumentsTable.$inferSelect;
