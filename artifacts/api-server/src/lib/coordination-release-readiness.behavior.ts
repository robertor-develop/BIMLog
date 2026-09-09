import assert from "node:assert/strict";
import { coordinationReleaseGateKeySchema, evaluateCoordinationReleaseReadiness } from "./coordination-release-readiness";

const input = { sourceHead: "a".repeat(40), evaluatedAt: "2026-09-09T17:00:00Z", gates: coordinationReleaseGateKeySchema.options.map((key) => ({ key, passed: true, evidence: `${key}: focused behavior PASS` })), externalEffects: { databaseApplied: false, providerActivated: false, messagesSent: false, deployed: false, published: false } } as const;
assert.equal(evaluateCoordinationReleaseReadiness(input).status, "ready_for_integration_review");
const failed = { ...input, gates: input.gates.map((gate) => gate.key === "composite_qc" ? { ...gate, passed: false } : gate) };
assert.deepEqual(evaluateCoordinationReleaseReadiness(failed), { status: "blocked", failedGates: ["composite_qc"] });
assert.throws(() => evaluateCoordinationReleaseReadiness({ ...input, gates: input.gates.slice(1) }));
assert.throws(() => evaluateCoordinationReleaseReadiness({ ...input, externalEffects: { ...input.externalEffects, deployed: true } }));
console.log("coordination release readiness behavior: PASS");
