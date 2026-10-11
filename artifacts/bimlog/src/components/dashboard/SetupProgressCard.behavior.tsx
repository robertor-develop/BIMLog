import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./SetupProgressCard.tsx",import.meta.url),"utf8");
assert.match(source,/deriveAdoptionProgress\(state\)/);
assert.match(source,/role="progressbar"/);
assert.match(source,/Continue setup/);
assert.match(source,/Continuar configuración/);
assert.match(source,/if \(progress\.completed\) return null/);
console.log("Simplification and guided adoption build 013 setup progress card: PASS");
