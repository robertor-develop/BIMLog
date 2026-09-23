import assert from "node:assert/strict";
import { projectActivatedEdtPlan } from "./edt-engine-plan-projection";
import type { ActivatedEdtSource } from "./edt-engine-source-service";

const source: ActivatedEdtSource = { project: { id: 11, code: "P11", name: "Project" },
  intake: { id: "intake", revision: 3, data: { commercial: { contracts: [{ id: "A", contractNumber: "C1" }] },
    scopeItems: [{ id: "scope", contractId: "A", deliverableType: "MODEL", workPackages: [{ id: "wp", dimensionType: "floor", dimensionValue: "L1", classification: { disciplineId: "d", disciplineCode: "HVAC" } }] }],
    governance: { budgetPolicy: "baseline" } },
  activationSummary: { contracts: [{ profileId: "A", contractId: "contract", contractVersionId: "version" }], pricing: { currency: "USD" } } },
  workItems: [{ id: "wi", stableScopeItemId: "scope", contractId: "contract", contractVersionId: "version", status: "active" }] };
const first = projectActivatedEdtPlan(source);
const changedGovernance = projectActivatedEdtPlan({ ...source, intake: { ...source.intake, data: { ...source.intake.data, governance: { budgetPolicy: "strict" } } } });
const changedPricing = projectActivatedEdtPlan({ ...source, intake: { ...source.intake, activationSummary: { ...source.intake.activationSummary, pricing: { currency: "EUR" } } } });
assert.deepEqual(first.nodes, changedGovernance.nodes);
assert.deepEqual(first.workItems, changedGovernance.workItems);
assert.notEqual(first.sourceFingerprint, changedGovernance.sourceFingerprint);
assert.notEqual(first.sourceFingerprint, changedPricing.sourceFingerprint);
assert.equal(first.sourceFingerprint, projectActivatedEdtPlan(source).sourceFingerprint);
console.log("EDT_ENGINE_BUILD330_RESULT=PASS source fingerprint binds complete activated Intake and activation snapshot");
