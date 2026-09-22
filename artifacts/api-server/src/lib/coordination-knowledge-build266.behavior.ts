import assert from "node:assert/strict";
import { deterministicStarterId, starterSeedFingerprint, validateCoordinationStarterSeed } from "./coordination-knowledge-starter-seed";

const seed = validateCoordinationStarterSeed({
  schemaVersion: 1,
  seedKey: "BIMTECH.STARTER.V1",
  displayName: "BIMTECH starter library",
  provenance: { source: "BIMLog controlled synthetic starter content", preparedFor: "BIMTECH professional review", preparedAt: "2026-09-22", synthetic: true, professionalApproval: "not_reviewed" },
  conflictTypes: [{ code: "DUCT-BEAM", name: "Duct versus beam", description: "Candidate recurring coordination condition.", disciplineA: "HVAC", disciplineB: "Structural", elementTypeA: "Duct", elementTypeB: "Beam", conflictCategory: "physical_clash", coordinationStage: "coordination", tags: ["starter"] }],
  rules: [{ code: "RULE-STRUCT-01", title: "Protect structural intent", guidance: "Obtain authorized professional review before structural modification.", rationale: "Structural changes require the responsible design authority.", conflictTypeCodes: ["DUCT-BEAM"], exceptions: [] }],
  resolutionMethods: [{ code: "METHOD-REROUTE", name: "Evaluate rerouting", description: "Candidate option for project-specific review.", conflictTypeCodes: ["DUCT-BEAM"], ruleCodes: ["RULE-STRUCT-01"], responsibleTrade: "HVAC", constraints: ["Confirm available clearance"], advantages: ["May avoid structural change"], disadvantages: ["May affect routing"], requiredApprovals: ["Project design authority"], rfiRequirement: "conditional" }],
});

assert.equal(seed.conflictTypes[0]?.code, "DUCT-BEAM");
assert.match(starterSeedFingerprint(seed), /^[a-f0-9]{64}$/);
assert.equal(starterSeedFingerprint(seed), starterSeedFingerprint(validateCoordinationStarterSeed(JSON.parse(JSON.stringify(seed)))));
assert.equal(deterministicStarterId(seed.seedKey, "conflict_type", "DUCT-BEAM"), deterministicStarterId(seed.seedKey, "conflict_type", "DUCT-BEAM"));
assert.match(deterministicStarterId(seed.seedKey, "conflict_type", "DUCT-BEAM"), /^[0-9a-f-]{36}$/);

assert.throws(() => validateCoordinationStarterSeed({ ...seed, projectId: 99 }), /STARTER_SEED_PROJECT_DATA_FORBIDDEN/);
assert.throws(() => validateCoordinationStarterSeed({ ...seed, provenance: { ...seed.provenance, synthetic: false } }), /STARTER_SEED_INVALID/);
assert.throws(() => validateCoordinationStarterSeed({ ...seed, rules: [{ ...seed.rules[0], conflictTypeCodes: ["UNKNOWN"] }] }), /STARTER_SEED_REFERENCE_UNKNOWN/);
assert.throws(() => validateCoordinationStarterSeed({ ...seed, conflictTypes: [...seed.conflictTypes, seed.conflictTypes[0]] }), /STARTER_SEED_DUPLICATE_CODE/);

console.log("Build 266 controlled starter seed contract: PASS");
