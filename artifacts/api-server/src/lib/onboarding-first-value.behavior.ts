import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../routes/onboarding.ts",import.meta.url),"utf8");
assert.match(source,/FROM rfis r JOIN project_members member ON member\.project_id=r\.project_id/);
assert.match(source,/FROM submittals s JOIN project_members member ON member\.project_id=s\.project_id/);
assert.match(source,/FROM files f JOIN project_members member ON member\.project_id=f\.project_id/);
assert.match(source,/firstValueReached:Boolean\(firstValueEvidence\)/);
console.log("Simplification and guided adoption build 016 authoritative first value: PASS");
