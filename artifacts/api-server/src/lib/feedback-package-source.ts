import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { projectsTable, usersTable } from "@workspace/db/schema";
import { feedbackAssetsTable, feedbackAuditEventsTable, feedbackItemsTable } from "../../../../lib/db/src/schema/feedback-items";
import { FEEDBACK_MAX_FILE_BYTES } from "./feedback-evidence-contract";
import { buildFeedbackPackage, FeedbackPackageError, FEEDBACK_PACKAGE_MAX_ASSETS, FEEDBACK_PACKAGE_MAX_EVENTS, type FeedbackPackageVisibility } from "./feedback-package";
import { storage } from "./storage-adapter";

export type FeedbackPackageAuthorization = (reader: Pick<typeof db, "select">) => Promise<boolean>;

export async function buildFeedbackPackageFromAuthority(args: {
  feedbackId: number;
  visibility: FeedbackPackageVisibility;
  baseUrl: string;
  authorize?: FeedbackPackageAuthorization;
}) {
  const source = await db.transaction(async tx => {
    if (args.authorize && !await args.authorize(tx)) return null;
    const [feedback] = await tx.select({ id: feedbackItemsTable.id, stableId: feedbackItemsTable.stableId, userId: feedbackItemsTable.userId, feedbackType: feedbackItemsTable.feedbackType, priority: feedbackItemsTable.priority, module: feedbackItemsTable.module, pageUrl: feedbackItemsTable.pageUrl, message: feedbackItemsTable.message, status: feedbackItemsTable.status, version: feedbackItemsTable.version, targetRelease: feedbackItemsTable.targetRelease, dispositionReason: feedbackItemsTable.dispositionReason, customerVisible: feedbackItemsTable.customerVisible, createdAt: feedbackItemsTable.createdAt, updatedAt: feedbackItemsTable.updatedAt, resolvedAt: feedbackItemsTable.resolvedAt, submitterName: usersTable.fullName, submitterEmail: usersTable.email, projectId: feedbackItemsTable.projectId, projectName: projectsTable.name, projectCode: projectsTable.code })
      .from(feedbackItemsTable).innerJoin(usersTable, eq(feedbackItemsTable.userId, usersTable.id)).leftJoin(projectsTable, eq(feedbackItemsTable.projectId, projectsTable.id)).where(eq(feedbackItemsTable.id, args.feedbackId)).limit(1);
    if (!feedback) return null;
    const events = await tx.select({ id: feedbackAuditEventsTable.id, eventType: feedbackAuditEventsTable.eventType, beforeState: feedbackAuditEventsTable.beforeState, afterState: feedbackAuditEventsTable.afterState, reason: feedbackAuditEventsTable.reason, createdAt: feedbackAuditEventsTable.createdAt }).from(feedbackAuditEventsTable).where(and(eq(feedbackAuditEventsTable.feedbackId, args.feedbackId),sql`${feedbackAuditEventsTable.eventType} NOT IN ('package_snapshot_created','feedback_telegram_delivery','admin_package_exported','admin_package_snapshot_exported','admin_exported','admin_follow_up_exported','admin_asset_exported','evidence_scan_started','evidence_scan_failed')`)).orderBy(feedbackAuditEventsTable.createdAt, feedbackAuditEventsTable.id).limit(FEEDBACK_PACKAGE_MAX_EVENTS + 1);
    const assets = await tx.select({ id: feedbackAssetsTable.id, kind: feedbackAssetsTable.kind, safeName: feedbackAssetsTable.safeName, mediaType: feedbackAssetsTable.mediaType, byteSize: feedbackAssetsTable.byteSize, sha256: feedbackAssetsTable.sha256, scanState: feedbackAssetsTable.scanState, scannedAt: feedbackAssetsTable.scannedAt, storagePath: feedbackAssetsTable.storagePath, createdAt: feedbackAssetsTable.createdAt }).from(feedbackAssetsTable).where(eq(feedbackAssetsTable.feedbackId, args.feedbackId)).orderBy(feedbackAssetsTable.createdAt, feedbackAssetsTable.id).limit(FEEDBACK_PACKAGE_MAX_ASSETS + 1);
    return { feedback, events, assets };
  });
  if (!source) return null;
  const assets = [];
  for (const asset of source.assets) {
    let bytes: Buffer | undefined;
    if (asset.scanState === "clean" && asset.scannedAt) {
      try { bytes = await storage.downloadBounded(asset.storagePath, FEEDBACK_MAX_FILE_BYTES); }
      catch { throw new FeedbackPackageError(`Evidence ${asset.id} could not be read safely`, "PACKAGE_ASSET_UNAVAILABLE"); }
    }
    assets.push({ ...asset, bytes });
  }
  const storageHealth = await storage.health();
  const byteStorage = storageHealth.backendType === "replit-app-storage" && storageHealth.backendId === "bimlog-feedback-replit"
    ? "Private Replit App Storage bucket bimlog-feedback-temporary"
    : `Private ${storageHealth.backendType} backend ${storageHealth.backendId}`;
  const row = source.feedback;
  return buildFeedbackPackage({ visibility: args.visibility, baseUrl: args.baseUrl, events: source.events, assets, custody: { metadataAuthority: "PostgreSQL", byteStorage, backendId: storageHealth.backendId, accessPolicy: "private-bimlog-authorized-access" }, feedback: { id: row.id, stableId: row.stableId, feedbackType: row.feedbackType, priority: row.priority, module: row.module, pageUrl: row.pageUrl, message: row.message, status: row.status, version: row.version, targetRelease: row.targetRelease, dispositionReason: row.dispositionReason, customerVisible: row.customerVisible, createdAt: row.createdAt, updatedAt: row.updatedAt, resolvedAt: row.resolvedAt, submitter: { id: row.userId, name: row.submitterName, email: row.submitterEmail }, project: row.projectId ? { id: row.projectId, name: row.projectName, code: row.projectCode } : null } });
}
