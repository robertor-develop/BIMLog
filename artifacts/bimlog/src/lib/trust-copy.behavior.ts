import assert from "node:assert/strict";
import { TRUST_FACTS } from "./trust-copy";
for (const fact of Object.values(TRUST_FACTS)) { assert.ok(fact.en.length > 40); assert.ok(fact.es.length > 40); }
assert.doesNotMatch(Object.values(TRUST_FACTS).map(v => v.en).join(" "), /never deleted|permanently retained|no copy/i);
console.log("trust copy behavior: PASS");
