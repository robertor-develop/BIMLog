import assert from "node:assert/strict";
import { canonicalCoordinationIdentity, reconcileCoordinationLinks, type CoordinationRecordIdentity } from "./construction-coordination-records";

const records: CoordinationRecordIdentity[] = [
  { projectId: 53, type: "issue", id: 10, version: 2 },
  { projectId: 53, type: "rfi", id: 20, version: 1 },
  { projectId: 53, type: "submittal", id: 30, version: 3 },
  { projectId: 53, type: "transmittal", id: 40, version: 1 },
  { projectId: 53, type: "meeting", id: 50, version: 4 },
  { projectId: 53, type: "schedule", id: 60, version: 0 },
  { projectId: 53, type: "change_order", id: 70, version: 2 },
];

assert.equal(canonicalCoordinationIdentity({ projectId: 53, type: "clash", id: 10, version: 2 }).key, "53:issue:10");
assert.equal(canonicalCoordinationIdentity({ projectId: 53, type: "schedule_item", id: 60 }).type, "schedule");

const link = { projectId: 53, from: records[0], to: records[1], relation: "raised_as" };
const reconciled = reconcileCoordinationLinks(records, [link, link]);
assert.equal(reconciled.records.length, 7);
assert.equal(reconciled.links.length, 1);
assert.equal(reconciled.links[0].fromKey, "53:issue:10");
assert.equal(reconciled.links[0].toKey, "53:rfi:20");

assert.throws(() => reconcileCoordinationLinks([...records, { ...records[0], version: 3 }], []), /Duplicate coordination state/);
assert.throws(() => reconcileCoordinationLinks(records, [{ ...link, projectId: 54 }]), /cannot cross project/);
assert.throws(() => reconcileCoordinationLinks(records, [{ ...link, to: { projectId: 53, type: "rfi", id: 999, version: 0 } }]), /unknown authoritative record/);

console.log("block 13 build 061 coordination identity: PASS");
