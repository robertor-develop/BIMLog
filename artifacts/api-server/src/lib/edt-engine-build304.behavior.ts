import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../routes/edt-engine.ts", import.meta.url), "utf8");
assert.match(source, /activation-requests", authMiddleware/);
assert.match(source, /activation-requests\/:requestId\/approve", authMiddleware/);
assert.match(source, /requestResolvedEdtActivation\(/);
assert.match(source, /approveResolvedEdtActivation\(/);
assert.doesNotMatch(source, /nodes: body\.nodes|workItems: body\.workItems/);
assert.doesNotMatch(source, /approveEdtActivation\(|requestEdtActivation\(/);
console.log("EDT_ENGINE_BUILD304_RESULT=PASS activation resolves authority and plans on server");
