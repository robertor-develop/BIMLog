import assert from "node:assert/strict";
import { allocateFloorHourCosts } from "./floor-hour-cost-contract";

const entries = [
  { id:"c-late", userId:22, assignmentId:"a2", workDate:"2026-10-02", createdAt:"2026-10-02T09:00:00Z", hours:"8", normalRate:"6.5", status:"approved" },
  { id:"d-first", userId:11, assignmentId:"a1", workDate:"2026-10-01", createdAt:"2026-10-01T09:00:00Z", hours:"96", normalRate:"5.1", status:"approved" },
  { id:"d-tie-b", userId:11, assignmentId:"a1", workDate:"2026-10-02", createdAt:"2026-10-02T09:00:00Z", hours:"3", normalRate:"5.1", status:"approved" },
  { id:"d-tie-a", userId:11, assignmentId:"a1", workDate:"2026-10-02", createdAt:"2026-10-02T09:00:00Z", hours:"3", normalRate:"5.1", status:"approved" },
];
const first = allocateFloorHourCosts({estimateVersionId:"estimate-v1",approvedHours:"100",entries});
const second = allocateFloorHourCosts({estimateVersionId:"estimate-v1",approvedHours:"100",entries:[...entries].reverse()});
assert.deepEqual(first, second, "input order must not affect costing");
assert.deepEqual(first.allocations.map(row=>[row.entryId,row.normalHours,row.excessHours]), [["d-first","96","0"],["c-late","4","4"],["d-tie-a","0","3"],["d-tie-b","0","3"]]);
assert.equal(first.totals.excessHours,"10");
assert.equal(new Set(first.allocations.map(row=>row.entryId)).size,entries.length);
console.log("UX133 mixed-person allocation is deterministic and does not double count: PASS");
