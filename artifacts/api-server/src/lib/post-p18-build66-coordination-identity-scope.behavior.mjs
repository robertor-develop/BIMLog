import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const hubRoute = await readFile(new URL("../routes/coordination-hub.ts", import.meta.url), "utf8");
const intakeRoute = await readFile(new URL("../routes/coordination.ts", import.meta.url), "utf8");
const service = await readFile(new URL("./coordination-hub-service.ts", import.meta.url), "utf8");
const store = await readFile(new URL("./coordination-hub-postgres-store.ts", import.meta.url), "utf8");

const checks = [
  ["summary requires authenticated project membership", /coordination-hub\/summary", authMiddleware, requireProjectMember\(\)/s, hubRoute],
  ["credential surfaces require project administrator authority", /credential-validation-operations", authMiddleware, requireProjectMember\("project_admin"\)/s, hubRoute],
  ["revision registration requires write permission", /coordination-hub\/revisions", authMiddleware, requirePermission\("admin", "write"\)/s, hubRoute],
  ["job enqueue requires write permission", /coordination-hub\/jobs", authMiddleware, requirePermission\("admin", "write"\)/s, hubRoute],
  ["intake upload requires write permission", /coordination\/intake",\s*authMiddleware,\s*requirePermission\("admin", "write"\)/s, intakeRoute],
  ["intake confirmation requires write permission", /coordination\/confirm",\s*authMiddleware,\s*requirePermission\("admin", "write"\)/s, intakeRoute],
  ["caller scope is replaced with authenticated route identity", /scope:\s*\{\s*projectId: Number\(req\.params\.projectId\),\s*companyId: req\.user!\.companyId,\s*actorUserId: req\.user!\.userId/s, hubRoute],
  ["service proves project and company authority before reads and writes", /await transaction\.assertProjectCompanyAuthority\(command\.scope\)/s, service],
  ["store binds authority to actor company and project membership", /u\.id=\$1[\s\S]*u\.company_id=\$2[\s\S]*pm\.project_id=\$3 AND pm\.user_id=\$1/s, store],
  ["summary queries remain company and project scoped", /coordination_files WHERE company_id=\$1 AND project_id=\$2/s, store],
];

for (const [name, pattern, source] of checks) assert.match(source, pattern, name);
console.log(`PASS post-P18 Build 66 Coordination identity and scope (${checks.length} checks)`);
