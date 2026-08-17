import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("src/routes/feedback.ts"), "utf8");
const assertions: Array<[string, RegExp]> = [
  ["current company is reloaded", /select\(\{ companyId: usersTable\.companyId \}\)/],
  ["project company is server-derived", /innerJoin\(usersTable, eq\(projectsTable\.createdById, usersTable\.id\)\)/],
  ["active membership is required", /eq\(projectMembersTable\.status, "active"\)/],
  ["page URL drops query and fragment", /url\.origin.*url\.pathname/],
  ["customer feedback is allowlisted", /const customerFeedbackDto/],
  ["customer history is visibility classified", /visibility: "customer"/],
  ["customer history event types are allowlisted", /CUSTOMER_EVENT_TYPES\.has/],
  ["asset upload is one file and bounded", /files: 1, fields: 4, parts: 5/],
  ["asset kind follows inspected media", /FEEDBACK_ASSET_KIND_MISMATCH/],
  ["per-file upload idempotency is mandatory", /per-file idempotency key are required/],
  ["upload races serialize", /pg_advisory_xact_lock/],
  ["transcription races recover the winner", /if \(!winner\) throw cause/],
  ["transcription DTO is allowlisted", /const transcriptionDto/],
  ["consent revocation is audited", /capture_consent_revoked/],
  ["CSV requires reason", /FEEDBACK_EXPORT_REASON_REQUIRED/],
  ["CSV action is audited", /eventType: "admin_exported"/],
];
for (const [name, pattern] of assertions) assert.match(source, pattern, name);
for (const forbidden of ["feedback: prior }", "feedback: winner }", "return res.json({ job });", "actorUserId: event.actorUserId", "metadata: feedbackItemsTable.metadata"])
  assert.equal(source.includes(forbidden), false, `response must not expose ${forbidden}`);
console.log(`feedback route authority source assertions: ${assertions.length + 5}/${assertions.length + 5} passed (runtime PostgreSQL not exercised)`);
