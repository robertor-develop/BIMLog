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
  ["asset upload is one file and bounded", /files: 1, fields: 4, parts: 5/],
  ["asset kind follows inspected media", /FEEDBACK_ASSET_KIND_MISMATCH/],
  ["per-file upload idempotency is mandatory", /per-file idempotency key are required/],
  ["upload identity uses canonical DB columns", /feedbackAssetsTable\.uploadRequestKey/],
  ["upload races serialize", /pg_advisory_xact_lock/],
  ["transcription races read the winner in transaction", /const \[winner\]=await tx\.select/],
  ["transcription authority uses transaction reader", /const fresh=await accessible\(id,user,tx\)/],
  ["transcription rechecks owned clean scanned asset", /eq\(feedbackAssetsTable\.uploadedById,user\.userId\).*eq\(feedbackAssetsTable\.scanState,"clean"\).*scannedAt/s],
  ["consent operations serialize", /capture-consent:\$\{consentId\}/],
  ["identical bytes deduplicate within feedback", /eq\(feedbackAssetsTable\.sha256,inspected\.sha256\).*deduplicated: true/s],
  ["dedup contract is explicit", /json\(\{ replayed, deduplicated,/],
  ["mine exposes safe transcription projection", /transcription:transcriptionByFeedback\.has\(row\.id\)\?transcriptionDto/],
  ["mine exposes relay lifecycle projection", /relayState:relayByFeedback\.get\(row\.id\)\|\|null/],
  ["create authority uses transaction reader", /projectAuthorized\(projectId, user, actor\.companyId, tx\)/],
  ["admin mutation reads inside transaction", /feedback-admin:\$\{id\}.*tx\.select\(\)\.from\(feedbackItemsTable\)/s],
  ["review authority uses transaction reader", /accessible\(id,user,tx\)\)return undefined/],
  ["reopen authority uses transaction reader", /fresh=await accessible\(id,user,tx\)/],
  ["comment authority uses transaction reader", /accessible\(id,user,tx\)\)return null/],
  ["transcription DTO is allowlisted", /const transcriptionDto/],
  ["consent revocation is audited", /capture_consent_revoked/],
  ["CSV requires reason", /FEEDBACK_EXPORT_REASON_REQUIRED/],
  ["CSV action is audited", /eventType: "admin_exported"/],
];
for (const [name, pattern] of assertions) assert.match(source, pattern, name);
assert.ok(source.indexOf("pg_advisory_xact_lock") < source.indexOf("storage.upload"), "upload idempotency must be reserved before object creation");
for (const forbidden of ["feedback: prior }", "feedback: winner }", "return res.json({ job });", "actorUserId: event.actorUserId", "metadata: feedbackItemsTable.metadata"])
  assert.equal(source.includes(forbidden), false, `response must not expose ${forbidden}`);
console.log(`feedback route authority source assertions: ${assertions.length + 6}/${assertions.length + 6} passed (runtime PostgreSQL not exercised)`);
