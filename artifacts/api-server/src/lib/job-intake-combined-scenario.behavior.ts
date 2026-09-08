import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeJobIntakeData, jobIntakeCompletion } from "./job-intake-contract";
import { buildActivatedCommercialBaseline } from "./job-activation-commercial-baseline";

const scenario = normalizeJobIntakeData({
  identity: { jobName: "Controlled multi-company job", jobCode: "CONTROL-19", clientName: "Owner One", clientCompany: "Owner One LLC", clientCompanyId: 101, primaryContact: "Owner Contact", primaryContactId: 1001, currency: "USD", location: "Controlled test site", startDate: "2026-09-01", targetCompletionDate: "2027-03-31" },
  relationships: {
    participants: [
      { id: "OWNER-ONE", companyId: 101, companyName: "Owner One LLC", role: "customer", primary: true },
      { id: "PROVIDER", companyId: 202, companyName: "Delivery Provider LLC", role: "service_provider" },
      { id: "OWNER-TWO", companyId: 303, companyName: "Owner Two LLC", role: "customer" },
    ],
    engagements: [
      { id: "ENG-OWNER-ONE", providerParticipantId: "PROVIDER", customerParticipantId: "OWNER-ONE", providerContactId: 2002, customerContactId: 1001, description: "Base coordination services" },
      { id: "ENG-OWNER-TWO", providerParticipantId: "PROVIDER", customerParticipantId: "OWNER-TWO", providerContactId: 2002, customerContactId: 3003, description: "Additional modeling services" },
    ],
  },
  commercial: {
    budgetSnapshotId: "BUDGET-SNAPSHOT-19",
    contracts: [
      { id: "BASE-ONE", title: "Owner One base contract", contractNumber: "BC-001", counterpartyName: "Owner One LLC", perspective: "upstream", contractType: "owner_prime", reportingType: "base_contract", reportingStatus: "work_in_progress", lifecycleStatus: "executed", engagementId: "ENG-OWNER-ONE", paymentTerms: "Net 30" },
      { id: "CHANGE-ONE", title: "Owner One change order", contractNumber: "CO-001", counterpartyName: "Owner One LLC", perspective: "upstream", contractType: "change_order", reportingType: "change_order", reportingStatus: "work_in_progress", lifecycleStatus: "executed", parentContractId: "BASE-ONE", engagementId: "ENG-OWNER-ONE", paymentTerms: "Net 30" },
      { id: "TAM-TWO", title: "Owner Two time and material", contractNumber: "TAM-002", counterpartyName: "Owner Two LLC", perspective: "upstream", contractType: "time_and_material", reportingType: "additional_work", reportingStatus: "work_in_progress", lifecycleStatus: "executed", engagementId: "ENG-OWNER-TWO", paymentTerms: "Biweekly approved time" },
    ],
  },
  scopeItems: [
    { id: "CI-BASE", name: "Coordination", contractId: "BASE-ONE", responsibleParticipantId: "PROVIDER", plannedHours: "80", billingHourlyRate: "35.47", apuPlanVersion: 3, budgetSnapshotLineId: "BL-BASE", projectCostNodeId: "PCN-BASE", workPackages: [{ id: "WP-L1", packageCode: "WP-L1", title: "Level 1 coordination", dimensionType: "floor", dimensionValue: "Level 1", packageType: "deliverable" }] },
    { id: "CI-CHANGE", name: "Change modeling", contractId: "CHANGE-ONE", responsibleParticipantId: "PROVIDER", plannedHours: "40", billingHourlyRate: "37.99", apuPlanVersion: 4, budgetSnapshotLineId: "BL-CHANGE", projectCostNodeId: "PCN-CHANGE", workPackages: [{ id: "WP-ZONE-A", packageCode: "WP-ZONE-A", title: "Zone A change", dimensionType: "zone", dimensionValue: "Zone A", packageType: "mixed" }] },
    { id: "CI-TAM", name: "T&M support", contractId: "TAM-TWO", responsibleParticipantId: "PROVIDER", plannedHours: "60", billingHourlyRate: "42.5", apuPlanVersion: 5, budgetSnapshotLineId: "BL-TAM", projectCostNodeId: "PCN-TAM", workPackages: [{ id: "WP-MILESTONE", packageCode: "WP-MILESTONE", title: "Owner Two milestone", dimensionType: "milestone", dimensionValue: "Issued set", packageType: "deliverable" }] },
  ],
  delivery: { workflowTemplate: "bim-submittal", submittalStrategy: "Controlled review and delivery", milestoneSummary: "Three controlled packages" },
  team: {
    projectLeaderUserId: 7001,
    assignments: [
      { id: "AS-BASE", userId: 7001, personName: "Lead Coordinator", role: "BIM Coordinator", scopeItemId: "CI-BASE", workPackageId: "WP-L1", engagementId: "ENG-OWNER-ONE", plannedHours: "80", internalHourlyRate: "21.25", incentiveAmount: "100" },
      { id: "AS-CHANGE", userId: 7002, personName: "Modeler", role: "BIM Modeler", scopeItemId: "CI-CHANGE", workPackageId: "WP-ZONE-A", engagementId: "ENG-OWNER-ONE", plannedHours: "40", internalHourlyRate: "18.5", incentiveAmount: "50" },
      { id: "AS-TAM", userId: 7003, personName: "Specialist", role: "Specialist", scopeItemId: "CI-TAM", workPackageId: "WP-MILESTONE", engagementId: "ENG-OWNER-TWO", plannedHours: "60", internalHourlyRate: "25", incentiveAmount: "0" },
    ],
  },
  review: { sourceConfirmed: true, scopeConfirmed: true, pricingConfirmed: true, contractConfirmed: true, deliveryConfirmed: true, teamConfirmed: true },
});

const completion = jobIntakeCompletion(scenario, []);
assert.equal(scenario.relationships.participants.length, 3);
assert.equal(scenario.relationships.engagements.length, 2);
assert.equal(new Set(scenario.relationships.participants.map((item: any) => item.companyId)).size, 3);
assert.equal(scenario.commercial.contracts.length, 3);
assert.equal(scenario.commercial.contracts[1].parentContractId, "BASE-ONE");
assert.deepEqual(scenario.scopeItems.map((item) => item.apuPlanVersion), [3, 4, 5]);
assert.deepEqual(scenario.scopeItems.map((item) => item.contractId), ["BASE-ONE", "CHANGE-ONE", "TAM-TWO"]);
assert.deepEqual(scenario.scopeItems.map((item) => item.workPackages[0]?.dimensionType), ["floor", "zone", "milestone"]);
assert.deepEqual(scenario.team.assignments.map((item: any) => item.userId), [7001, 7002, 7003]);
assert.deepEqual(scenario.team.assignments.map((item: any) => item.contractId), ["BASE-ONE", "CHANGE-ONE", "TAM-TWO"]);
assert.deepEqual(scenario.team.assignments.map((item: any) => item.internalHourlyRate), ["21.25", "18.5", "25"]);
assert.deepEqual(scenario.team.assignments.map((item: any) => item.customerHourlyRate), ["35.47", "37.99", "42.5"]);
assert.deepEqual(scenario.team.assignments.map((item: any) => item.apuCalculationRate), ["35.47", "37.99", "42.5"]);
assert.deepEqual(scenario.team.assignments.map((item: any) => item.incentiveAmount), ["100", "50", "0"]);
assert.equal(completion.ready, true);
assert.equal(completion.totals.plannedHours, "180");
assert.equal(completion.totals.assignedHours, "180");
assert.equal(completion.readinessSummary.work.assignmentCoveragePercent, 100);
assert.equal(completion.readinessSummary.financial.setupPercent, 100);

const baseline = buildActivatedCommercialBaseline({
  intakeId: "INTAKE-BUILD-19", projectId: 919, currency: "USD", workflowInstances: 3, workItems: 3, tasks: 3, resourceAssignments: 3,
  contracts: scenario.commercial.contracts.map((contract: any) => ({
    profileId: contract.id, contractId: `LIVE-${contract.id}`, contractVersionId: `VERSION-${contract.id}`, contractNumber: contract.contractNumber, currency: "USD",
    items: scenario.scopeItems.filter((item) => item.contractId === contract.id).map((item) => ({ stableLineId: item.id, displayName: item.name, projectCostNodeId: item.projectCostNodeId, budgetSnapshotLineId: item.budgetSnapshotLineId, quantity: item.plannedHours, unit: item.unit, unitRate: item.billingHourlyRate, contractValue: item.contractValue, apuPlanVersion: item.apuPlanVersion, workflowTemplate: scenario.delivery.workflowTemplate })),
  })),
});
assert.equal(baseline.projectBudget.contractCount, 3);
assert.equal(baseline.contractItems.length, 3);
assert.equal(baseline.budgetAccounts.length, 3);
assert.equal(baseline.contractItems.every((item) => Boolean(item.budgetAccountId)), true);
assert.match(baseline.contentFingerprint, /^[a-f0-9]{64}$/);

const operationsService = fs.readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");
for (const evidence of ["originalUserId", "completedHours", "remainingTransferredHours", "reason, version"]) assert.match(operationsService, new RegExp(evidence));

console.log(JSON.stringify({ status: "PASS", scenario: "BUILD19_COMBINED_BUSINESS_SCENARIO", companies: 3, engagements: 2, contracts: 3, apuVersions: 3, workPackages: 3, resources: 3, plannedHours: completion.totals.plannedHours, financialSetup: completion.readinessSummary.financial.setupPercent, baselineFingerprint: baseline.contentFingerprint }));
