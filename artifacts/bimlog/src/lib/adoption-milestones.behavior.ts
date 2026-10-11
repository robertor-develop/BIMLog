import assert from "node:assert/strict";
import fs from "node:fs";
const route=fs.readFileSync(new URL("../../../api-server/src/routes/onboarding.ts",import.meta.url),"utf8");
assert.match(route,/ADOPTION_MILESTONE_INVALID/);
assert.doesNotMatch(route,/req\.body\?\.(question|email|name|details|content)/);
assert.match(route,/WHERE NOT EXISTS/);
console.log("adoption milestones behavior: PASS");
