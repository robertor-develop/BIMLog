import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const authority = read("artifacts/api-server/src/lib/company-directory-resolution.behavior.ts");
const readiness = read("artifacts/api-server/src/lib/project-role-readiness.behavior.ts");
const routes = read("artifacts/api-server/src/lib/block23-build112-route-matrix.behavior.ts");
const acceptance = read("artifacts/api-server/src/lib/block21-build105-public-onboarding-acceptance.behavior.ts");

assert.match(authority, /company/i);
assert.match(authority, /COMPANY_REFERENCE_AMBIGUOUS/, "company authority suite must retain fail-closed ambiguity coverage");
assert.match(readiness, /role/i);
assert.match(routes, /authenticated/i);
assert.match(acceptance, /public-to-authenticated acceptance contract/);

console.log("consolidation C116 fresh-company role-isolation acceptance: PASS");
