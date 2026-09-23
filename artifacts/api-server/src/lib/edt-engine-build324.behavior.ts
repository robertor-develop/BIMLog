import assert from "node:assert/strict";
import { normalizeJobIntakeData } from "./job-intake-contract";
import { projectActivatedEdtPlan } from "./edt-engine-plan-projection";
import type { ActivatedEdtSource } from "./edt-engine-source-service";

const data = normalizeJobIntakeData({
  identity: { name: "QA project", code: "QA24" },
  commercial: { contracts: [
    { id: "BASE", title: "Base contract", contractNumber: "B-1" },
    { id: "EXTRA", title: "Extra contract", contractNumber: "E-2" },
  ] },
  scopeItems: [
    { id: "scope-base", name: "Base sleeves", contractId: "BASE", deliverableType: "SLEEVE", plannedHours: "8", workPackages: [{ id: "wp-base", dimensionType: "floor", dimensionValue: "L2", classification: { disciplineId: "discipline-hvac", disciplineCode: "HVAC" } }] },
    { id: "scope-extra", name: "Extra sleeves", contractId: "EXTRA", deliverableType: "SLEEVE", plannedHours: "4", workPackages: [{ id: "wp-extra", dimensionType: "zone", dimensionValue: "Zone A", classification: { disciplineId: "discipline-elec", disciplineCode: "ELEC" } }] },
  ],
});
const source: ActivatedEdtSource = {
  project: { id: 24, code: "QA24", name: "QA project" },
  intake: { id: "intake-24", revision: 5, data, activationSummary: { contracts: [
    { profileId: "BASE", contractId: "contract-base", contractVersionId: "version-base" },
    { profileId: "EXTRA", contractId: "contract-extra", contractVersionId: "version-extra" },
  ] } },
  workItems: [
    { id: "wi-base", stableScopeItemId: "scope-base", contractId: "contract-base", contractVersionId: "version-base", status: "active" },
    { id: "wi-extra", stableScopeItemId: "scope-extra", contractId: "contract-extra", contractVersionId: "version-extra", status: "active" },
  ],
};
const plan = projectActivatedEdtPlan(source);
assert.deepEqual(plan.nodes.map(node => node.kind), ["project", "contract", "contract", "deliverable", "location", "deliverable", "location"]);
assert.equal(plan.workItems.length, 2);
assert.notEqual(plan.workItems[0].contractSourceIdentity, plan.workItems[1].contractSourceIdentity);
assert.notEqual(plan.workItems[0].displayCode, plan.workItems[1].displayCode);
function conflict(change: (value: ActivatedEdtSource) => ActivatedEdtSource, code: string) {
  assert.throws(() => projectActivatedEdtPlan(change(source)), (error: unknown) => error instanceof Error && "code" in error && error.code === code);
}
conflict(value => ({ ...value, workItems: [{ ...value.workItems[0], contractVersionId: "wrong-version" }, value.workItems[1]] }), "EDT_SOURCE_AMBIGUOUS");
conflict(value => ({ ...value, workItems: [value.workItems[0]] }), "EDT_PLAN_COVERAGE_MISMATCH");
conflict(value => ({ ...value, intake: { ...value.intake, data: { ...value.intake.data, scopeItems: [{ ...data.scopeItems[0], workPackages: [] }, data.scopeItems[1]] } } }), "EDT_LOCATION_AMBIGUOUS");
conflict(value => ({ ...value, intake: { ...value.intake, data: { ...value.intake.data, scopeItems: [{ ...data.scopeItems[0], workPackages: [{ ...data.scopeItems[0].workPackages[0], classification: { ...data.scopeItems[0].workPackages[0].classification, disciplineId: "" } }] }, data.scopeItems[1]] } } }), "EDT_SOURCE_AMBIGUOUS");
console.log("EDT_ENGINE_BUILD324_RESULT=PASS normalized multi-contract Intake projects without invented identities and ambiguity fails closed");
