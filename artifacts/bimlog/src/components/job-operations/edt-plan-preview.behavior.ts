import assert from "node:assert/strict";
import { describeEdtPreviewError, parseEdtPlanPreview } from "./EdtPlanPreviewPanel";

const valid = { sourceFingerprint: "a".repeat(64), nodes: [
  { kind: "project", sourceIdentity: "project:11", name: "Test", code: "T" },
  { kind: "location", sourceIdentity: "location:w1", name: "L2", code: "L2" },
], workItems: [{ id: "w1", displayCode: "T-C-S-L2-HVAC", tradeIdentity: "hvac", locationIdentity: "location:w1" }] };
assert.equal(parseEdtPlanPreview(valid).workItems[0].displayCode, "T-C-S-L2-HVAC");
for (const invalid of [null, {}, { ...valid, sourceFingerprint: "bad" }, { ...valid, workItems: [] },
  { ...valid, nodes: [{ ...valid.nodes[0], kind: "unknown" }] },
  { ...valid, workItems: [{ ...valid.workItems[0], locationIdentity: "" }] }]) {
  assert.throws(() => parseEdtPlanPreview(invalid), /incomplete/);
}
const tt = (english: string) => english;
assert.match(describeEdtPreviewError(Object.assign(new Error("The request failed."), { code: "EDT_CONTRACT_SOURCE_MISSING" }), tt), /canonical Contract version/);
assert.match(describeEdtPreviewError(Object.assign(new Error("The request failed."), { code: "EDT_LOCATION_AMBIGUOUS" }), tt), /floor or area Work Package/);
assert.match(describeEdtPreviewError(new Error("The request failed."), tt), /Refresh and try again/);
console.log("EDT_ENGINE_BUILD334_RESULT=PASS read-only Operations preview accepts complete plans and rejects incomplete responses");
