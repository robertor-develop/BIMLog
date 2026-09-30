import assert from "node:assert/strict";
import { allocateFloorHourCosts } from "./floor-hour-cost-contract";

const rows = [
  {id:"approved",workDate:"2026-09-01",createdAt:"2026-09-01T09:00:00Z",hours:"90",normalRate:"5.1",status:"approved"},
  {id:"rejected",workDate:"2026-09-02",createdAt:"2026-09-02T09:00:00Z",hours:"12",normalRate:"5.1",status:"rejected"},
  {id:"old",workDate:"2026-09-03",createdAt:"2026-09-03T09:00:00Z",hours:"20",normalRate:"5.1",status:"approved",supersededByEntryId:"corrected"},
  {id:"corrected",workDate:"2026-09-03",createdAt:"2026-09-03T10:00:00Z",hours:"15",normalRate:"5.1",status:"approved"},
];
const v1=allocateFloorHourCosts({estimateVersionId:"estimate-v1",approvedHours:"100",entries:rows});
const v2=allocateFloorHourCosts({estimateVersionId:"estimate-v2",approvedHours:"110",entries:rows});
assert.deepEqual(v1.allocations.map(row=>row.entryId),["approved","corrected"]);
assert.deepEqual(v1.totals,{normalHours:"100",excessHours:"5",normalCost:"510",excessCost:"17.5",totalCost:"527.5"});
assert.deepEqual(v2.totals,{normalHours:"105",excessHours:"0",normalCost:"535.5",excessCost:"0",totalCost:"535.5"});
assert.equal(v1.estimateVersionId,"estimate-v1");
assert.equal(v2.estimateVersionId,"estimate-v2");
console.log("UX134 corrections and revised estimates recompute as new auditable versions: PASS");
