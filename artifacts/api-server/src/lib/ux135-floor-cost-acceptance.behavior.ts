import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { allocateFloorHourCosts } from "./floor-hour-cost-contract";

const entry=(id:string,hours:string,rate="5.1")=>({id,workDate:"2026-09-30",createdAt:`2026-09-30T10:00:0${id}Z`,hours,normalRate:rate,status:"approved"});
assert.deepEqual(allocateFloorHourCosts({estimateVersionId:"v1",approvedHours:"100",entries:[entry("1","99")]}).totals,{normalHours:"99",excessHours:"0",normalCost:"504.9",excessCost:"0",totalCost:"504.9"});
assert.deepEqual(allocateFloorHourCosts({estimateVersionId:"v1",approvedHours:"100",entries:[entry("1","100")]}).totals,{normalHours:"100",excessHours:"0",normalCost:"510",excessCost:"0",totalCost:"510"});
assert.deepEqual(allocateFloorHourCosts({estimateVersionId:"v1",approvedHours:"100",entries:[entry("1","110")]}).totals,{normalHours:"100",excessHours:"10",normalCost:"510",excessCost:"35",totalCost:"545"});
const partial=allocateFloorHourCosts({estimateVersionId:"v1",approvedHours:"100",entries:[entry("1","98"),entry("2","5","6.5")]});
assert.deepEqual(partial.allocations.map(row=>[row.normalHours,row.excessHours,row.totalCost]),[["98","0","499.8"],["2","3","23.5"]]);
const governance=fs.readFileSync(path.join(import.meta.dirname,"floor-hour-cost-governance.ts"),"utf8");
const routes=fs.readFileSync(path.join(import.meta.dirname,"../routes/job-operations.ts"),"utf8");
const page=fs.readFileSync(path.join(import.meta.dirname,"../../../bimlog/src/pages/JobOperationsWorkspace.tsx"),"utf8");
for(const token of ["FLOOR_HOUR_CEO_APPROVAL_REQUIRED","writeAllocationRun","sourceFingerprint","status='superseded'","customer billing"])assert.match(governance,new RegExp(token,"i"));
assert.match(routes,/floor-hour-estimates\/:estimateVersionId\/decision/);
assert.match(page,/Only hours beyond the CEO-approved floor estimate/);
assert.match(page,/No approved floor-hour estimate exists/);
console.log("UX135 floor-hour boundaries, breakdown, governance, and UI acceptance: PASS");
