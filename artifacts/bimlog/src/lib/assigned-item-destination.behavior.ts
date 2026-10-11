import assert from "node:assert/strict";
import { assignedItemDestination } from "./assigned-item-destination";

assert.equal(assignedItemDestination({ kind: "rfi", id: 70, projectId: 7, number: "RFI-7", title: "Opening" }), "/projects/7/rfis?rfi=70");
assert.equal(assignedItemDestination({ kind: "submittal", id: 80, projectId: 8, number: "SUB-8", title: "Package" }), "/projects/8/submittals?submittal=80");
assert.equal(assignedItemDestination({ kind: "rfi", id: 0, projectId: 7, number: "RFI-7", title: "Opening" }), null);
assert.equal(assignedItemDestination({ kind: "submittal", id: 80, projectId: -1, number: "SUB-8", title: "Package" }), null);
console.log("Simplification and guided adoption build 038 exact assigned-item destinations: PASS");
