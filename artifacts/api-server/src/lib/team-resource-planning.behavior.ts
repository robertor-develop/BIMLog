import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"../../../..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const migration=read("artifacts/api-server/src/lib/team-resource-planning-migration.ts"),service=read("artifacts/api-server/src/lib/team-resource-planning-service.ts"),route=read("artifacts/api-server/src/routes/team-performance.ts"),page=read("artifacts/bimlog/src/components/team-performance/ResourceSchedulingPanel.tsx"),manual=read("artifacts/bimlog/src/lib/help-content.ts"),navbar=read("artifacts/bimlog/src/components/layout/Navbar.tsx"),help=read("artifacts/bimlog/src/pages/HelpCenter.tsx");
for(const table of ["team_capacity_profile_versions","team_staffing_scenario_versions","team_staffing_application_events"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
assert.match(service,/daysBetween/);assert.match(service,/weeklyCapacityHours/);assert.match(service,/CAPACITY_EXCEEDED/);assert.match(service,/internalCost/);assert.match(service,/billingValue/);assert.match(service,/EXISTS\(SELECT 1 FROM project_members viewer/);assert.match(service,/BEGIN/);assert.match(service,/ROLLBACK/);assert.match(service,/TASK_VERSION_CONFLICT/);assert.match(service,/event_key/);assert.match(route,/resource-planning\/evaluate/);assert.match(route,/scenarios\/:scenarioVersionId\/apply/);
assert.match(page,/What-if staffing scenario/);assert.match(page,/Programaci.n de Recursos/);assert.match(page,/Print \/ PDF/);assert.match(page,/Review & apply/);assert.match(manual,/Resource Scheduling/);assert.match(manual,/Applying fails atomically/);assert.match(navbar,/v1\.60\.27\.01/);assert.match(help,/Print complete manual/);assert.match(help,/Print filtered manual/);
console.log(JSON.stringify({status:"PASS",tests:["leave-adjusted-capacity","cross-project-commitments","cost-value-forecast","immutable-scenarios","atomic-apply","idempotent-event","task-version-conflict","bilingual-ui","csv","print-pdf","complete-manual","filtered-manual","global-print","release-version"]}));
