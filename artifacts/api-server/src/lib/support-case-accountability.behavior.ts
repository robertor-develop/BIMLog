import assert from "node:assert/strict";
import {supportResponseDueAt,supportResponseIsOverdue} from "./support-case-accountability";
assert.equal(supportResponseDueAt(new Date("2026-10-02T12:00:00.000Z"),"urgent").toISOString(),"2026-10-02T16:00:00.000Z");
assert.equal(supportResponseDueAt(new Date("2026-10-02T12:00:00.000Z"),"normal").toISOString(),"2026-10-05T12:00:00.000Z");
assert.equal(supportResponseIsOverdue({status:"open",responseDueAt:new Date("2026-10-02T16:00:00.000Z"),now:new Date("2026-10-02T16:00:01.000Z")}),true);
assert.equal(supportResponseIsOverdue({status:"resolved",responseDueAt:new Date("2026-10-02T16:00:00.000Z"),now:new Date("2026-10-03T00:00:00.000Z")}),false);
console.log("B151 deterministic support response targets: PASS");
