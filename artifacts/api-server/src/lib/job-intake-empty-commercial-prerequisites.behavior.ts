import assert from "node:assert/strict";
import {
  jobIntakeCompletion,
  normalizeJobIntakeData,
  type JobIntakeCapabilities,
} from "./job-intake-contract";

const capabilities = (
  enabled: Partial<JobIntakeCapabilities>,
): JobIntakeCapabilities => ({
  package: false,
  budget: false,
  contracts: false,
  costValuePlanner: false,
  anyCommercial: false,
  fullCommercialActivation: false,
  ...enabled,
});

const fixture = (commercialEvidence: {
  apuPlanVersion?: number;
  budgetSnapshotId?: string;
  budgetSnapshotLineId?: string;
  projectCostNodeId?: string;
}) =>
  normalizeJobIntakeData({
    identity: {
      jobName: "Empty commercial prerequisite proof",
      jobCode: "EMPTY-COMMERCIAL-1",
      clientName: "Controlled client",
      currency: "USD",
    },
    scopeItems: [
      {
        id: "CI-1",
        name: "Drafting",
        plannedHours: "50",
        billingHourlyRate: "35.47",
        apuPlanVersion: commercialEvidence.apuPlanVersion,
        budgetSnapshotLineId: commercialEvidence.budgetSnapshotLineId,
        projectCostNodeId: commercialEvidence.projectCostNodeId,
      },
    ],
    commercial: {
      budgetSnapshotId: commercialEvidence.budgetSnapshotId,
    },
    delivery: {
      workflowTemplate: "generic",
      submittalStrategy: "Controlled delivery",
    },
    team: {
      projectLeaderUserId: 1,
      assignments: [
        {
          id: "ASSIGNMENT-1",
          userId: 1,
          role: "Specialist",
          scopeItemId: "CI-1",
          plannedHours: "50",
          internalHourlyRate: "5.1",
        },
      ],
    },
    review: {
      scopeConfirmed: true,
      pricingConfirmed: true,
      deliveryConfirmed: true,
      teamConfirmed: true,
    },
  });

const stage = (result: ReturnType<typeof jobIntakeCompletion>, key: string) =>
  result.stages.find((entry) => entry.key === key);
const missingCodes = (result: ReturnType<typeof jobIntakeCompletion>) =>
  result.missingItems.map((item) => item.code);

const noVersions = fixture({});
const coreOnly = jobIntakeCompletion(noVersions, [], capabilities({}));
assert.equal(coreOnly.ready, true, "core Intake must not depend on commercial versions");

const emptyApu = jobIntakeCompletion(
  noVersions,
  [],
  capabilities({ costValuePlanner: true, anyCommercial: true }),
);
assert.equal(emptyApu.ready, false);
assert.equal(stage(emptyApu, "pricing")?.status, "in_progress");
assert.deepEqual(missingCodes(emptyApu), ["pricing"]);
assert.equal(noVersions.scopeItems[0].billingHourlyRate, "35.47");
assert.equal(noVersions.scopeItems[0].apuPlanVersion, null);

const apuOnly = jobIntakeCompletion(
  fixture({ apuPlanVersion: 7 }),
  [],
  capabilities({ costValuePlanner: true, anyCommercial: true }),
);
assert.equal(apuOnly.ready, true);
assert.equal(stage(apuOnly, "pricing")?.status, "complete");

const emptyBudget = jobIntakeCompletion(
  noVersions,
  [],
  capabilities({ budget: true, anyCommercial: true }),
);
assert.equal(emptyBudget.ready, false);
assert.equal(stage(emptyBudget, "contract")?.status, "not_started");
assert.deepEqual(missingCodes(emptyBudget), ["budget_mapping", "budget_snapshot"]);

const budgetOnly = jobIntakeCompletion(
  fixture({
    budgetSnapshotId: "SNAPSHOT-1",
    budgetSnapshotLineId: "LINE-1",
    projectCostNodeId: "NODE-1",
  }),
  [],
  capabilities({ budget: true, anyCommercial: true }),
);
assert.equal(budgetOnly.ready, true);
assert.equal(stage(budgetOnly, "contract")?.status, "complete");

const emptyFullCommercial = jobIntakeCompletion(
  noVersions,
  [],
  capabilities({ budget: true, costValuePlanner: true, anyCommercial: true }),
);
assert.equal(emptyFullCommercial.ready, false);
assert.deepEqual(missingCodes(emptyFullCommercial), [
  "pricing",
  "budget_mapping",
  "budget_snapshot",
]);

const configuredFullCommercial = jobIntakeCompletion(
  fixture({
    apuPlanVersion: 7,
    budgetSnapshotId: "SNAPSHOT-1",
    budgetSnapshotLineId: "LINE-1",
    projectCostNodeId: "NODE-1",
  }),
  [],
  capabilities({ budget: true, costValuePlanner: true, anyCommercial: true }),
);
assert.equal(configuredFullCommercial.ready, true);

console.log(
  JSON.stringify({
    status: "PASS",
    scenario: "BUILD1_EMPTY_COMMERCIAL_PREREQUISITE_REPRODUCTION",
    zeroVersionFieldDeadEndReproduced: true,
    manualRatePreserved: noVersions.scopeItems[0].billingHourlyRate,
    cases: [
      "core_without_versions",
      "apu_enabled_without_version",
      "apu_with_version",
      "budget_enabled_without_snapshot",
      "budget_with_snapshot",
      "full_commercial_without_versions",
      "full_commercial_configured",
    ],
  }),
);
