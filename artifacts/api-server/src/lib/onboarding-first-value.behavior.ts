import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../routes/onboarding.ts",import.meta.url),"utf8");
assert.match(source,/EXISTS\(SELECT 1 FROM rfis r WHERE r\.project_id=m\.project_id\)/);
assert.match(source,/EXISTS\(SELECT 1 FROM submittals s WHERE s\.project_id=m\.project_id\)/);
assert.match(source,/EXISTS\(SELECT 1 FROM files f WHERE f\.project_id=m\.project_id\)/);
assert.match(source,/firstValueReached:row\.first_value_reached/);
console.log("Simplification and guided adoption build 016 authoritative first value: PASS");
