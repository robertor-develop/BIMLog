import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../routes/onboarding.ts",import.meta.url),"utf8");
assert.match(source,/typeof req\.body\?\.guidePaused==="boolean"/);
assert.match(source,/completed_steps - CASE WHEN \$5::boolean IS FALSE THEN 'guide_paused'/);
assert.match(source,/CASE WHEN \$5::boolean IS TRUE THEN '\["guide_paused"\]'/);
assert.doesNotMatch(source,/const guidePaused=req\.body\?\.guidePaused===true/);
console.log("Simplification and guided adoption build 012 server-backed guide resume: PASS");
