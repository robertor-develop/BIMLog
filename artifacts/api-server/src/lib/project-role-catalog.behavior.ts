import assert from "node:assert/strict";
import { canonicalProjectRole, isWritableProjectRole, PROJECT_ROLES } from "./project-role-catalog.js";
import { mapCurrentProjectRole } from "./scoped-authority.js";

assert.equal(new Set(PROJECT_ROLES).size, PROJECT_ROLES.length);
assert.equal(canonicalProjectRole("owner"), "project_admin");
assert.equal(canonicalProjectRole("admin"), "project_admin");
assert.equal(canonicalProjectRole("viewer"), "read_only");
assert.equal(canonicalProjectRole("reviewer"), "read_only");
assert.equal(canonicalProjectRole("unknown"), null);
assert.deepEqual(mapCurrentProjectRole("member").authorities, mapCurrentProjectRole("drafter").authorities);
assert.equal(isWritableProjectRole("member"), true);
assert.equal(isWritableProjectRole("drafter"), true);
assert.equal(isWritableProjectRole("viewer"), false);
console.log(JSON.stringify({ status: "PASS", roles: PROJECT_ROLES }));
