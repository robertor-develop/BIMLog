import assert from "node:assert/strict";
import { deriveEdtActivationCandidate } from "./edt-engine-activation-candidate";
import type { ActivatedEdtSource } from "./edt-engine-source-service";

const source: ActivatedEdtSource = {
  project: { id: 11, code: "P11", name: "Project 11" },
  intake: { id: "intake-1", revision: 4,
    data: { commercial: { contracts: [{ id: "profile-1", contractNumber: "C1", title: "Contract 1" }] },
      scopeItems: [{ id: "scope-1", contractId: "profile-1", deliverableType: "SLEEVE",
        workPackages: [{ id: "wp-1", dimensionType: "floor", dimensionValue: "L2",
          classification: { disciplineId: "trade-1", disciplineCode: "HVAC" } }] }] },
    activationSummary: { configurationSnapshot: { budgetGovernancePolicy: "standard", deliveryMethod: "bim-submittal" },
      commercialBaselineFingerprint: "c".repeat(64),
      contracts: [{ profileId: "profile-1", contractId: "contract-1", contractVersionId: "version-1" }] } },
  workItems: [{ id: "wi-1", stableScopeItemId: "scope-1", contractId: "contract-1", contractVersionId: "version-1", status: "active" }],
  canonicalContracts: [{ contractId: "contract-1", versionId: "version-1", currency: "USD", contentFingerprint: "a".repeat(64) }],
  workflowBindings: [{ workItemId: "wi-1", source: "bimlog", versionId: null, templateCode: "bim-submittal", templateVersion: 1, fingerprint: "b".repeat(64) }],
};
const candidate = deriveEdtActivationCandidate(source);
assert.equal(candidate.intakeRevision, 4);
assert.match(candidate.governanceVersionId, /^activated-governance:[a-f0-9]{64}$/);
assert.match(candidate.pricingVersionId, /^activated-commercial:[a-f0-9]{64}$/);
assert.equal(candidate.workflowVersionIds.length, 1);
assert.equal(candidate.plan.workItems.length, 1);
assert.deepEqual(deriveEdtActivationCandidate(source), candidate);
assert.throws(() => deriveEdtActivationCandidate({ ...source, workflowBindings: [] }),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_ACTIVATION_SOURCE_INCOMPLETE");
assert.throws(() => deriveEdtActivationCandidate({ ...source, intake: { ...source.intake, activationSummary: { contracts: source.intake.activationSummary.contracts } } }),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_ACTIVATION_SOURCE_INCOMPLETE");
console.log("EDT_ENGINE_BUILD337_RESULT=PASS server-owned activation candidate and fail-closed missing versions");
