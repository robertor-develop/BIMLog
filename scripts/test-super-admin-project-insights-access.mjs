import assert from "node:assert/strict";
import fs from "node:fs";
import {
  projectInsightsAccessHeaders,
  validProjectReadReason,
} from "../artifacts/bimlog/src/pages/project/project-insights-access.ts";

const access = { projectId: 57, userId: 9, reason: "Cross-company QA project audit" };
assert.equal(validProjectReadReason(access.reason), true);
assert.equal(validProjectReadReason("short"), false);
assert.equal(validProjectReadReason("Injected reason <script>"), false);
assert.deepEqual(projectInsightsAccessHeaders(null, 57, 9), {});
assert.deepEqual(projectInsightsAccessHeaders(access, 58, 9), {});
assert.deepEqual(projectInsightsAccessHeaders(access, 57, 10), {});
assert.deepEqual(projectInsightsAccessHeaders({ ...access, reason: "short" }, 57, 9), {});
assert.deepEqual(projectInsightsAccessHeaders(access, 57, 9), {
  "x-bimlog-super-admin-access": "project-read",
  "x-bimlog-super-admin-reason": access.reason,
});

const source = fs.readFileSync("artifacts/bimlog/src/pages/project/AnalyticsTab.tsx", "utf8");
assert.match(source, /response\.status === 403 && body\.error === "PROJECT_ACCESS_DENIED"/);
assert.match(source, /projectInsightsAccessHeaders\(confirmedAccess, projectId, user\?\.id\)/);
assert.equal((source.match(/\.\.\.explicitAccessHeaders/g) ?? []).length, 2);
console.log("SUPER_ADMIN_PROJECT_INSIGHTS_ACCESS=PASS project/user isolation, reason validation, read and export headers");
