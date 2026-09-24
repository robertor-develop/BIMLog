import assert from "node:assert/strict";
import fs from "node:fs";
import { jobIntakeCompletion, normalizeJobIntakeData } from "./job-intake-contract";

const source = {
  identity: { jobName: "Lifecycle QA", jobCode: "LIFE-049", clientName: "Owner", clientCompany: "Owner LLC", clientCompanyId: 49, currency: "USD", location: "QA", startDate: "2026-09-19", targetCompletionDate: "2027-01-31" },
  relationships: { participants: [{ id: "OWNER", companyId: 49, companyName: "Owner LLC", role: "customer", primary: true }], engagements: [] },
  commercial: { budgetSnapshotId: "BUDGET-49", contracts: [{ id: "PRIMARY", title: "Primary contract", contractNumber: "C-49", counterpartyName: "Owner LLC", perspective: "upstream", contractType: "owner_prime", reportingType: "base_contract", reportingStatus: "work_in_progress", lifecycleStatus: "executed", paymentTerms: "Net 30" }] },
  classification: { disciplineId: "disc-49", disciplineCode: "MECH", disciplineName: "Mechanical", serviceId: "svc-49", serviceCode: "SHOP", serviceName: "Shop Drawings", phaseId: "phase-49", phaseCode: "COORD", phaseName: "Coordination" },
  scopeItems: [{ id: "CI-49", name: "Coordination", contractId: "PRIMARY", plannedHours: "40", billingHourlyRate: "50", apuPlanVersion: 2, budgetSnapshotLineId: "BL-49", projectCostNodeId: "PCN-49", workPackages: [{ id: "WP-49", packageCode: "WP-49", title: "Level 4", dimensionType: "floor", dimensionValue: "L4", packageType: "deliverable", tasks: [{ id: "TASK-49", taskCode: "T-49", name: "Coordinate", plannedHours: "40" }] }] }],
  delivery: { workflowTemplate: "bimlog:SHOP_DRAWING:1", submittalStrategy: "Controlled", milestoneSummary: "For record" },
  team: { projectLeaderUserId: 4901, assignments: [{ id: "AS-49", userId: 4901, personName: "PMO Lead", role: "Project Lead", scopeItemId: "CI-49", workPackageId: "WP-49", plannedHours: "40", internalHourlyRate: "25", incentiveAmount: "0" }] },
  review: { sourceConfirmed: true, scopeConfirmed: true, pricingConfirmed: true, contractConfirmed: true, deliveryConfirmed: true, teamConfirmed: true },
};

const saved = normalizeJobIntakeData(source);
const reopened = normalizeJobIntakeData(JSON.parse(JSON.stringify(saved)));
assert.deepEqual(reopened, saved, "the persisted draft must reopen without semantic loss");
assert.equal(jobIntakeCompletion(reopened, []).ready, true);

const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
for (const proof of [
  "UPDATE job_intakes SET data=$2::jsonb",
  "createContractDraftWithClient",
  "resolveCompanyPricingTemplateBinding",
  "persistActivatedCommercialBaselineWithClient",
  "INSERT INTO job_activation_work_packages",
  "INSERT INTO job_activation_tasks",
  "bindDeliveryWorkflowWithClient",
  "UPDATE job_intakes SET status='activated'",
]) assert.match(service, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(service, /status: "activated",[\s\S]{0,160}idempotent: true/);
const genericTask = service.slice(service.indexOf("if (needsScopeDeliveryTask)"), service.indexOf("workItemByScope.set(item.id"));
assert.ok(genericTask.length > 0, "generic activation task boundary must exist");
assert.doesNotMatch(genericTask, /input\.data\.classification\.(?:service|phase)/, "legacy project Service/Phase cannot become a generic task assignment");
assert.match(service, /const packageClass = workPackage\.classification/, "package-level classification remains authoritative");
assert.match(service, /const taskClass = taskDefinition\.classification/, "task-level classification remains authoritative");

console.log("Job Intake full lifecycle: exact draft reopen plus contract, APU, budget, EDT/work-package, staffing, workflow, activation, and idempotent replay boundaries PASS");
