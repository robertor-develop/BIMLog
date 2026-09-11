import assert from "node:assert/strict";
import { jobIntakeCompletion, normalizeJobIntakeData } from "./job-intake-contract";

const intake = normalizeJobIntakeData({
  identity: { currency: "USD" },
  commercial: { contracts: [{ id: "BASE", title: "Base contract" }] },
  scopeItems: [
    { id: "DRAFT", name: "Drafting", contractId: "BASE", unit: "Hours", plannedHours: "10", billingHourlyRate: "35.47", apuPlanVersion: 1 },
    { id: "COORD", name: "Coordination", contractId: "BASE", unit: "Hours", plannedHours: "5", billingHourlyRate: "37.99", apuPlanVersion: 2 },
  ],
  team: { assignments: [
    { id: "A1", userId: 1, personName: "One", scopeItemId: "DRAFT", plannedHours: "10", internalHourlyRate: "5.10", incentiveAmount: "4.25" },
    { id: "A2", userId: 2, personName: "Two", scopeItemId: "COORD", plannedHours: "5", internalHourlyRate: "8.20", incentiveAmount: "3.75" },
  ] },
});

const completion = jobIntakeCompletion(intake, []);
assert.equal(intake.scopeItems[0]?.contractValue, "354.7");
assert.equal(intake.scopeItems[1]?.contractValue, "189.95");
assert.equal(intake.team.assignments[0]?.plannedLaborCost, "51");
assert.equal(intake.team.assignments[1]?.plannedLaborCost, "41");
assert.equal(intake.team.assignments[0]?.customerHourlyRate, "35.47");
assert.equal(intake.team.assignments[1]?.customerHourlyRate, "37.99");
assert.equal(completion.totals.contractValue, "544.65");
assert.equal(completion.totals.plannedLaborCost, "92");
assert.equal(completion.totals.plannedHours, "15");
assert.equal(intake.team.assignments.reduce((sum: number, item: { incentiveAmount: string }) => sum + Number(item.incentiveAmount), 0), 8);

console.log("POST-P17 Build 21 financial calculation and rate-separation invariants: PASS");
