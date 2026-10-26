import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const governance = readFileSync(new URL("./internal-cost-governance.ts", import.meta.url), "utf8");
const operations = readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");

assert.match(
  governance,
  /!row\.isCeo\s*&&\s*Number\(row\.companyId\)\s*!==\s*companyId/,
  "ordinary users must stay company-bound while the database-backed global administrator can inspect an authorized project",
);
assert.match(
  operations,
  /!row\.is_super_admin\s*&&\s*Number\(row\.actor_company\)\s*!==\s*Number\(row\.project_company\)/,
  "Job Operations must retain its tenant guard for ordinary users",
);
assert.match(
  operations,
  /getInternalCostGovernance\(\{ actorUserId: input\.actorUserId, companyId: access\.companyId/,
  "internal-cost governance must be projected from the authoritative project company",
);

console.log("Terminal GA Build 6 Operations authority: PASS global administrator project context and ordinary-user tenant isolation");
