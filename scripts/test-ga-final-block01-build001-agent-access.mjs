import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
const routes = readFileSync("artifacts/api-server/src/routes/agents.ts", "utf8");

const authenticatedBimtechRoles = ["super_admin", "company_admin", "project_admin", "coordinator", "member", "viewer"];
for (const role of authenticatedBimtechRoles) {
  assert.doesNotMatch(panel, new RegExp(`role\\s*[=!]==?\\s*["']${role}["']`), `${role} must not be excluded by the panel`);
}
assert.match(panel, /if\(!token\)return null/);
assert.doesNotMatch(panel, /if\(!isSuperAdmin\)return null/);
assert.match(routes, /router\.post\("\/assistant\/ask", authMiddleware,/);
assert.match(routes, /router\.post\("\/projects\/:projectId\/assistant\/ask", authMiddleware, requireProjectMember\(\),/);
assert.match(routes, /req\.user\.userId/);
assert.match(routes, /req\.user\.companyId/);

console.log(`GA-F01-B001 authenticated BIMTech agent access: PASS roles=${authenticatedBimtechRoles.length}`);
