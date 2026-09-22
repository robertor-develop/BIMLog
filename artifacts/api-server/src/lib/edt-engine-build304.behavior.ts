import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../routes/edt-engine.ts", import.meta.url), "utf8");
assert.match(source, /activation-requests", authMiddleware/);
assert.match(source, /activation-requests\/:requestId\/approve", authMiddleware/);
assert.equal(source.match(/ACTIVATION_PLAN_NOT_SERVER_RESOLVED/g)?.length, 2);
assert.doesNotMatch(source, /nodes: body\.nodes|workItems: body\.workItems/);
assert.doesNotMatch(source, /approveEdtActivation\(|requestEdtActivation\(/);
console.log("EDT_ENGINE_BUILD304_RESULT=PASS incomplete activation routes fail closed");
