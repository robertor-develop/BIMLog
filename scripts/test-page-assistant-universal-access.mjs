import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel=readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx","utf8");
const routes=readFileSync("artifacts/api-server/src/routes/agents.ts","utf8");
assert.match(panel,/if\(!token\)return null/);
assert.doesNotMatch(panel,/if\(!isSuperAdmin\)return null/);
assert.match(panel,/Guidance and reporting are available to every user/);
assert.match(panel,/projectId===null\?"\/api\/v1\/assistant\/ask"/);
assert.match(routes,/router\.post\("\/assistant\/ask", authMiddleware,/);
assert.match(routes,/router\.post\("\/projects\/:projectId\/assistant\/ask", authMiddleware, requireProjectMember\(\),/);
assert.match(panel,/data-dock=\{dock\}/);
assert.match(panel,/role="separator"/);
console.log("page assistant universal authenticated access: pass");
