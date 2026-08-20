import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("src/routes/feedback.ts"), "utf8");
const assertions: Array<[string, RegExp]> = [
  ["current company is reloaded", /select\(\{ companyId: usersTable\.companyId \}\)/],
  ["project company is server-derived", /innerJoin\(usersTable, eq\(projectsTable\.createdById, usersTable\.id\)\)/],
  ["active membership is required", /eq\(projectMembersTable\.status, "active"\)/],
  ["page URL is application-relative", /return url\.pathname\.slice/],
  ["customer feedback is allowlisted", /const customerFeedbackDto/],
  ["customer history is visibility classified", /visibility: "customer"/],
  ["customer history event types are allowlisted", /CUSTOMER_EVENT_TYPES\.has/],
  ["asset upload is one file plus the six governed metadata fields and bounded", /files: 1, fields: 6, parts: 7/],
  ["asset kind follows inspected media", /FEEDBACK_ASSET_KIND_MISMATCH/],
  ["per-file upload idempotency is mandatory", /per-file idempotency key are required/],
  ["upload identity uses canonical DB columns", /feedbackAssetsTable\.uploadRequestKey/],
  ["upload races serialize", /pg_advisory_xact_lock/],
  ["transcription races read the winner in transaction", /const \[winner\]=await tx\.select/],
  ["transcription authority uses transaction reader", /const fresh=await accessible\(id,user,tx\)/],
  ["transcription rechecks owned clean scanned asset", /eq\(feedbackAssetsTable\.uploadedById,user\.userId\).*eq\(feedbackAssetsTable\.scanState,"clean"\).*scannedAt/s],
  ["consent operations serialize", /capture-consent:\$\{consentId\}/],
  ["capture consent is single-evidence", /FEEDBACK_CAPTURE_CONSENT_CONSUMED/],
  ["semantic identity guards identical-byte dedup", /identityMatches.*FEEDBACK_ASSET_PROVENANCE_CONFLICT.*asset_upload_receipt/s],
  ["dedup contract is explicit", /json\(\{ replayed, deduplicated,/],
  ["mine exposes safe transcription projection", /transcription:transcriptionByFeedback\.has\(row\.id\)\?transcriptionDto/],
  ["transcription reason is customer allowlisted", /customerTranscriptionReason.*provider-unavailable/s],
  ["mine exposes per-evidence relay lifecycle projection", /relays:\(relaysByFeedback\.get\(row\.id\)\|\|\[\]\)\.map\(relay=>\(\{assetId:relay\.assetId,state:relay\.state/s],
  ["relay reason projection is a customer enum", /const customerRelayReason = \(state: string\) => \(\{ queued: "awaiting-delivery".*expired: "retention-ended"/s],
  ["relay selection preserves every asset lineage", /\$\{relay\.feedbackId\}:\$\{relay\.assetId\}:\$\{relay\.lineageId\}.*relaysByFeedback/s],
  ["relay history has deterministic job sequence time order", /orderBy\(feedbackRelayCustodyEventsTable\.jobId,feedbackRelayCustodyEventsTable\.sequence,feedbackRelayCustodyEventsTable\.occurredAt\)/],
  ["customer routes do not bypass reporter authority", /if \(!actor \|\| !row\.companyId \|\| actor\.companyId !== row\.companyId \|\| row\.userId !== user\.userId/],
  ["audio origin is explicit and validated", /audio: new Set\(\["browser-microphone", "user-file-import"\]\)/],
  ["imported audio does not require capture consent", /const captureKind = origin === "browser-microphone".*else if \(consentId\)/s],
  ["imported-audio transcription uses processing consent", /audioOrigin==="user-file-import"\?"transcription":"audio"/],
  ["blocked transcription requires explicit successor", /TRANSCRIPTION_SUCCESSOR_REQUIRED.*TRANSCRIPTION_ADAPTER_UNCHANGED/s],
  ["download enforces stored and actual byte bounds", /asset\.byteSize > FEEDBACK_MAX_FILE_BYTES.*bytes\.byteLength > FEEDBACK_MAX_FILE_BYTES/s],
  ["download requires bounded adapter read", /downloadBounded\?\:.*maxBytes.*FEEDBACK_BOUNDED_DOWNLOAD_UNAVAILABLE/s],
  ["physical oversize abort is mapped", /STORAGE_OBJECT_TOO_LARGE.*FEEDBACK_DOWNLOAD_TOO_LARGE/s],
  ["create authority uses transaction reader", /projectAuthorized\(projectId, user, actor\.companyId, tx\)/],
  ["admin mutation reads inside transaction", /feedback-admin:\$\{id\}.*tx\.select\(\)\.from\(feedbackItemsTable\)/s],
  ["review authority uses transaction reader", /accessible\(id,user,tx\)\)return undefined/],
  ["reopen authority uses transaction reader", /fresh=await accessible\(id,user,tx\)/],
  ["comment authority uses transaction reader", /accessible\(id,user,tx\)\)return null/],
  ["transcription DTO is allowlisted", /const transcriptionDto/],
  ["consent revocation is audited", /capture_consent_revoked/],
  ["CSV requires reason", /FEEDBACK_EXPORT_REASON_REQUIRED/],
  ["CSV action is audited", /eventType: "admin_exported"/],
  ["intake persists a notification outbox before delivery", /submission_notification_outbox_created.*return \{ status: 201, row/s],
  ["notification failure cannot roll back canonical intake", /notificationState = "retry-required".*canonical intake remains durable/s],
  ["reviewer notification opens the real feedback tab", /actionUrl: `\/admin\?tab=feedback&feedback=/],
  ["admin queue projects evidence disposition", /packageState: counts\.total === 0.*awaiting-scan/s],
  ["admin package detail exposes sanitized evidence state", /\/feedback\/admin\/:id\/detail.*scannerAdapter.*scanState/s],
  ["staff can claim feedback without forging owner identity", /ownerUserId: req\.body\.claimToMe === true \? user\.userId/],
];
for (const [name, pattern] of assertions) assert.match(source, pattern, name);
assert.ok(source.indexOf("pg_advisory_xact_lock") < source.indexOf("storage.upload"), "upload idempotency must be reserved before object creation");
for (const forbidden of ["errorCode: row.errorCode", "storage.download(asset.storagePath)", "feedbackRelayJobsTable.lastErrorCode", "feedbackRelayJobsTable.expiryOutcome", "feedbackRelayCustodyEventsTable.reasonCode", "if (user.isSuperAdmin) return true", "if (user.isSuperAdmin) return row", "feedback: prior }", "feedback: winner }", "return res.json({ job });", "actorUserId: event.actorUserId", "metadata: feedbackItemsTable.metadata", "storagePath:feedbackRelayJobsTable"])
  assert.equal(source.includes(forbidden), false, `response must not expose ${forbidden}`);
const customerDtoSource = source.slice(source.indexOf("const customerFeedbackDto"), source.indexOf("const customerEventState"));
assert.equal(customerDtoSource.includes("dispositionReason"), false, "customer DTO must not expose internal disposition reason");
console.log(`feedback route authority source assertions: ${assertions.length + 6}/${assertions.length + 6} passed (runtime PostgreSQL not exercised)`);
