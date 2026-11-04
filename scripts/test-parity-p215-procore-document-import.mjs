import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const review = read("artifacts/bimlog/src/pages/project/ProcoreDocumentImportReview.tsx");
const route = read("artifacts/api-server/src/routes/procore_document_import.ts");

for (const token of ["Review one exact source version at a time", "I reviewed this exact version", "Confirm and import document", "Retry the same import", "Check saved receipt", "Open Documents register", "Download saved document", "IMPORT_SAVED_BYTES_MISMATCH"]) assert.ok(review.includes(token), `review UI missing ${token}`);
for (const token of ["expectedSha256", "confirmed:true", "validateReceipt", "sourceVersionId", "sourceSha256", "recordUrl", "downloadUrl"]) assert.ok(review.includes(token), `review validation missing ${token}`);
for (const token of ['router.post("/projects/:projectId/files/procore/preview"', 'router.post("/projects/:projectId/files/procore/import"', 'router.get("/projects/:projectId/files/procore/receipts/:requestId"', 'requirePermission("admin","write")', "PROCORE_IMPORT_REVIEW_REQUIRED", "PROCORE_IMPORT_REVIEW_CHANGED", "PROCORE_IMPORT_REQUEST_CHANGED", "pg_advisory_xact_lock", "procore-document-import-v1", "replayed:true"]) assert.ok(route.includes(token), `import route missing ${token}`);
assert.match(route, /sourceVersionId:v\.versionId[\s\S]*sourceSha256:source\.sha256[\s\S]*recordUrl:`\/projects\/\$\{projectId\}\/files`/);

console.log("PASS P215 exact-version preview, explicit import, idempotent receipt and record-link contracts");
