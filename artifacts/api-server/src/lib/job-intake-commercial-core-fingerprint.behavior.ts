import assert from "node:assert/strict";
import { normalizeJobIntakeData, jobIntakeCoreFingerprint } from "./job-intake-contract";

const core = normalizeJobIntakeData({
  identity: { jobName: "TEST commercial enrichment", jobCode: "TEST-C020", currency: "USD" },
  scopeItems: [{ id: "CI-1", name: "Drawing", plannedHours: "12", billingHourlyRate: "50" }],
  team: { assignments: [{ id: "A-1", userId: 1, scopeItemId: "CI-1", plannedHours: "12", internalHourlyRate: "30" }] },
});
const enriched = normalizeJobIntakeData({ ...core,
  scopeItems: core.scopeItems.map(item => ({ ...item, apuPlanVersion: 1, billingHourlyRate: "55" })),
});
assert.notDeepEqual(core.team.assignments, enriched.team.assignments);
assert.equal(jobIntakeCoreFingerprint(core), jobIntakeCoreFingerprint(enriched),
  "APU-derived assignment mirrors must not block commercial enrichment of activated core work");
for (const change of [{ plannedHours: "13" }, { userId: 2 }, { role: "Changed role" }]) {
  const modified = normalizeJobIntakeData({ ...enriched,
    team: { ...enriched.team, assignments: enriched.team.assignments.map((a: (typeof core.team.assignments)[number]) => ({ ...a, ...change })) },
  });
  assert.notEqual(jobIntakeCoreFingerprint(core), jobIntakeCoreFingerprint(modified),
    "Actual operational changes remain protected");
}
assert.notEqual(jobIntakeCoreFingerprint(core), jobIntakeCoreFingerprint(normalizeJobIntakeData({
  ...core, scopeItems: core.scopeItems.map(item => ({ ...item, productionAllocation: "285.60" })),
})), "Previously protected production allocation remains immutable");
console.log("C020 commercial mirrors versus immutable operational scope: PASS");
