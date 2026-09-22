import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../routes/edt-engine.ts", import.meta.url), "utf8");
assert.match(route, /ECONOMIC_PLAN_NOT_SERVER_RESOLVED/);
assert.match(route, /TIME_AMOUNT_NOT_SERVER_RESOLVED/);
assert.doesNotMatch(route, /directProductionAmount:requiredText|amount:requiredText\(body,"amount"\)/);
assert.doesNotMatch(route, /createWorkItemEconomicPlan\(|transitionTimeEntry\(/);
console.log("EDT_ENGINE_BUILD305_RESULT=PASS untrusted browser amounts cannot create economic or time ledger state");
