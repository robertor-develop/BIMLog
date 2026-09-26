import assert from "node:assert/strict";
import fs from "node:fs";
import { validateCurrentOpenLoopAuthority } from "./current-open-loop-authority.mjs";

const inventory = JSON.parse(fs.readFileSync("living-brief/OPEN_LOOP_DISPOSITIONS.json", "utf8"));
const current = validateCurrentOpenLoopAuthority(inventory);
assert.ok(current.some(item => item.workClass === "PRODUCT_WORK"));
assert.ok(current.some(item => item.workClass === "PROVIDER_EVIDENCE" && /SharePoint/.test(item.statement)));
assert.ok(current.some(item => item.workClass === "FIELD_EVIDENCE" && /Navisworks 2025/.test(item.statement)));
assert.ok(!current.some(item => /Build 275/.test(item.statement)));
for (const mutate of [
  value => { value.items.find(item => item.currentAuthority).classification = "SUPERSEDED"; },
  value => { value.items.find(item => item.currentAuthority).ownership = null; },
  value => { value.items.find(item => item.currentAuthority).evidence = []; },
  value => { value.currentAuthority.uncheckedItems = []; },
  value => { value.items.find(item => item.currentAuthority).workClass = "UNKNOWN"; },
]) {
  const invalid = structuredClone(inventory);
  mutate(invalid);
  assert.throws(() => validateCurrentOpenLoopAuthority(invalid));
}
const ledger = JSON.parse(fs.readFileSync("evidence/coordination-routing-20260925/BUILD_LEDGER.json", "utf8"));
assert.equal(ledger.currentReleaseReconciliation.commit, "25d6952efa2f7694734d3a8d34e47800ecde30ee");
assert.equal(ledger.currentReleaseReconciliation.baselineUnpublishedBuilds, 0);
assert.equal(ledger.currentReleaseReconciliation.fullSiteAcceptance, "NOT_COMPLETE");
assert.equal(ledger.sharePointDestinationRepairBlock.unpublishedBuilds, 5, "Historical checkpoint is preserved, not overwritten");
console.log("C001=PASS current ownership/classification and negative cases; historical publication counts preserved separately");
