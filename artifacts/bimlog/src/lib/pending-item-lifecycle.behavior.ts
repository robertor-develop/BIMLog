import assert from "node:assert/strict";
import fs from "node:fs";
import { pendingItemLifecycle } from "./pending-item-lifecycle";

for (const type of ["rfis", "submittals", "files"] as const) {
  for (const lang of ["en", "es"] as const) {
    const lifecycle = pendingItemLifecycle(type, { status: "pending_review", dueDate: "2026-10-30", title: "Record" }, lang);
    assert.ok(lifecycle.state && lifecycle.missing && lifecycle.actor && lifecycle.nextAction && lifecycle.result);
  }
}
assert.match(pendingItemLifecycle("rfis", {}, "en").missing, /status.*due date.*title/);
assert.equal(pendingItemLifecycle("files", { status: "non_compliant", title: "Model.nwd" }, "en").state, "non compliant");
const source = fs.readFileSync(new URL("../pages/PendingItems.tsx", import.meta.url), "utf8");
for (const label of ["State", "Missing", "Who can act", "Next action", "Result appears in"]) assert.match(source, new RegExp(label));
assert.match(source, /pendingItemLifecycle\(type/);
console.log("VISIBLE_PRINCIPAL_LIFECYCLES_P018=PASS types=3 languages=2");
