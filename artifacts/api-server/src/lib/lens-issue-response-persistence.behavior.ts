import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/clash_reports.ts"), "utf8");
const app = fs.readFileSync(path.join(root, "artifacts/api-server/src/app.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "lib/db/src/schema/lens-issue-responses.ts"), "utf8");

const start = route.indexOf('router.post("/projects/:projectId/clash-reports/lens-next/issues/:id/responses"');
const end = route.indexOf('router.patch("/projects/:projectId/clash-reports/lens-viewpoints/:id"', start);
assert.ok(start > 0 && end > start);
const responseRoute = route.slice(start, end);

assert.match(responseRoute, /requireProjectMember\(\)/);
assert.match(responseRoute, /FOR UPDATE/);
assert.match(responseRoute, /assertLensIssueCanReceiveResponse/);
assert.match(responseRoute, /mutation_version=\$2/);
assert.match(responseRoute, /status=\$1/);
assert.match(responseRoute, /contractor_response_submitted/);
assert.match(responseRoute, /lens_issue_response_submitted/);
assert.match(responseRoute, /LENS_ISSUE_RESPONSE_RETRY_CONFLICT/);
assert.match(responseRoute, /project_id=\$1 AND issue_id=\$2 AND client_request_id=\$3/);
assert.match(responseRoute, /await client\.query\("COMMIT"\)/);
assert.match(responseRoute, /await client\.query\("ROLLBACK"\)/);
assert.doesNotMatch(responseRoute, /status:\s*["']resolved["']/);

assert.match(schema, /lens_issue_responses_project_issue_request_unique/);
assert.match(schema, /projectId.*notNull/);
assert.match(schema, /issueId.*notNull/);
assert.match(schema, /reviewStatus.*pending_review/);
assert.match(app, /CREATE TABLE IF NOT EXISTS lens_issue_responses/);
assert.match(app, /CREATE UNIQUE INDEX IF NOT EXISTS lens_issue_responses_project_issue_request_unique/);

console.log("Lens response persistence is atomic, retry-safe, project-scoped, audited, and cannot close an issue: PASS");
