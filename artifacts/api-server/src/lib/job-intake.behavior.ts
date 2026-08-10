import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jobIntakeCompletion, normalizeJobIntakeData } from "./job-intake-contract";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(here, relative), "utf8");
const data = normalizeJobIntakeData({
  identity: { jobName: "River Avenue", jobCode: "1185R", clientName: "Example Client", clientCompany: "Example Client LLC", currency: "USD" },
  scopeItems: [{ id: "SHOP-DRAWINGS", name: "Shop drawings", plannedHours: "180", billingHourlyRate: "30.73", apuPlanVersion: 3, budgetSnapshotLineId: "budget-line-1", projectCostNodeId: "cost-node-1", unit: "Hours" }],
  commercial: { quotationNumber: "Q-100", contractNumber: "C-100", counterpartyName: "Example Client LLC", perspective: "upstream", contractType: "owner_prime", budgetSnapshotId: "snapshot-1" },
  delivery: { workflowTemplate: "bim-submittal", submittalStrategy: "Draft, review, submit, distribute." },
  team: { projectLeaderUserId: 5, assignments: [{ id: "A-1", userId: 5, personName: "Coordinator", role: "BIM Coordinator", scopeItemId: "SHOP-DRAWINGS", plannedHours: "180", internalHourlyRate: "21.25" }] },
  review: { sourceConfirmed: true, scopeConfirmed: true, pricingConfirmed: true, contractConfirmed: true, deliveryConfirmed: true, teamConfirmed: true },
});
const completion = jobIntakeCompletion(data, [{ category: "quotation" }, { category: "takeoff" }]);
const coreCapabilities = { package: false, budget: false, contracts: false, costValuePlanner: false, anyCommercial: false, fullCommercialActivation: false };
const coreCompletion = jobIntakeCompletion(data, [{ category: "quotation" }, { category: "takeoff" }], coreCapabilities);
const incompleteCore = jobIntakeCompletion(normalizeJobIntakeData({}), [], coreCapabilities);

assert.equal(data.scopeItems[0]?.contractValue, "5531.4", "billing hourly rate must be the exact commercial joining factor");
assert.equal(data.team.assignments[0]?.plannedLaborCost, "3825", "internal hourly cost must be the exact staffing joining factor");
assert.equal(completion.totals.contractValue, "5531.4");
assert.equal(completion.totals.plannedLaborCost, "3825");
assert.equal(completion.totals.plannedHours, "180");
assert.equal(completion.totals.unassignedHours, "0");
assert.equal(completion.percent, 100);
assert.equal(completion.ready, true);
assert.match(completion.fingerprint, /^[a-f0-9]{64}$/);
assert.equal(coreCompletion.ready, true, "core Intake activation must not require paid Commercial features");
assert.equal(coreCompletion.stages.find((stage) => stage.key === "pricing")?.required, false);
assert.equal(coreCompletion.stages.find((stage) => stage.key === "contract")?.required, false);
assert.equal(incompleteCore.missingItems.every((item) => Boolean(item.en && item.es)), true, "every visible missing requirement must be bilingual");

const migration = read("./job-intake-migration.ts");
const contract = read("./job-intake-contract.ts");
const service = read("./job-intake-service.ts");
const routes = read("../routes/job-intake.ts");
const app = read("../app.ts");
const ui = read("../../../bimlog/src/pages/JobIntakeWorkspace.tsx");
const schema = read("../../../../lib/db/src/schema/job-intakes.ts");
assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|CONSTRAINT)\b/i, "intake migration must remain additive");
for (const table of ["job_intakes", "job_intake_documents", "job_intake_events", "job_activation_work_items", "job_activation_tasks", "job_activation_resource_assignments"]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
for (const table of ["job_activation_work_items", "job_activation_tasks", "job_activation_resource_assignments"]) assert.match(schema, new RegExp(`pgTable\\("${table}"`));
assert.match(routes, /singleFileUpload\(\{ fileSize: 25 \* 1024 \* 1024, files: 1, fields: 2, parts: 3/);
assert.match(routes, /authMiddleware/);
assert.match(service, /createContractDraftWithClient/);
assert.match(service, /initializeContractItemWorkflowsWithClient/);
assert.match(service, /commercialWorkflowInstances: workflowBaseline\.created/);
assert.match(service, /plannedHours[\s\S]*billingHourlyRate/);
assert.match(service, /createCoreActivationWithClient/);
assert.match(service, /fullCommercialActivation/);
assert.match(service, /job_activation_resource_assignments/);
assert.match(contract, /internalHourlyRate/);
assert.match(app, /startJobIntakeMigration\(\)/);
assert.match(app, /await waitForJobIntakeMigration\(\)/);
assert.match(ui, /Core included/);
assert.match(ui, /Las horas planificadas conectan el alcance/);
assert.match(ui, /Los costos horarios internos son una función opcional/);
assert.match(ui, /Cómputo de cantidades/);
assert.match(ui, /Aún falta/);
assert.match(ui, /missingItems\.map/);
assert.match(ui, /capabilities\.costValuePlanner/);
assert.match(ui, /capabilities\.budget/);
assert.match(ui, /capabilities\.contracts/);
assert.match(ui, /Save & continue later/);
assert.match(ui, /Activate operational job/);
assert.match(ui, /@media\(max-width:900px\)/);

console.log(JSON.stringify({ status: "PASS", exactBillingValue: data.scopeItems[0]?.contractValue, exactPlannedLaborCost: data.team.assignments[0]?.plannedLaborCost, completion: completion.percent, tests: ["hourly-joining-factor", "separate-internal-cost", "commercial-completion", "core-activation-without-paid-features", "bilingual-requirements", "additive-migration", "resource-activation", "bounded-upload", "contract-activation", "automatic-workflow-baseline", "startup", "bilingual-entitlement-aware-ui"] }));
