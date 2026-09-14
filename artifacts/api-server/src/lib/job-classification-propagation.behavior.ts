import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeJobIntakeData } from "./job-intake-contract";

const projectClass = { disciplineId:"7",disciplineCode:"MECH",disciplineName:"Mechanical",serviceId:"svc-shop",serviceCode:"SHOP",serviceName:"Shop Drawings",phaseId:"phase-coord",phaseCode:"COORD",phaseName:"Coordination" };
const taskClass = { ...projectClass, serviceId:"svc-sleeve",serviceCode:"SLEEVE",serviceName:"Sleeve Drawings" };
const data = normalizeJobIntakeData({ classification: projectClass, scopeItems:[{ id:"CI-1",name:"Modeling",plannedHours:"8",workPackages:[{id:"WP-1",title:"Cellar",tasks:[{id:"TASK-1",name:"Sleeves",plannedHours:"8",classification:taskClass}]}]}] });
assert.deepEqual(data.scopeItems[0]!.workPackages[0]!.classification, projectClass);
assert.deepEqual(data.scopeItems[0]!.workPackages[0]!.tasks[0]!.classification, taskClass);
const migration = fs.readFileSync(new URL("./job-intake-migration.ts", import.meta.url), "utf8");
const activation = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../../artifacts/bimlog/src/components/job-intake/WorkPackageBuilder.tsx", import.meta.url), "utf8");
for (const column of ["discipline_id","service_id","phase_id"]) { assert.match(migration,new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`)); assert.match(activation,new RegExp(column)); }
assert.match(ui,/Use project default/);
assert.match(ui,/task\.classification/);
console.log("job package/task governed classification propagation: PASS");
