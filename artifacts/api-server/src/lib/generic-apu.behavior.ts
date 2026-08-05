import assert from "node:assert/strict";

const engineModulePath = "./generic-apu-" + "engine.ts";
const { evaluateGenericApu } = await import(engineModulePath);

const checks: Array<{ number: number; name: string; evidence: string }> = [];
const check = (name: string, evidence: string) =>
  checks.push({ number: checks.length + 1, name, evidence });
const throwsCode = (fn: () => unknown, code: string) =>
  assert.throws(fn, (error: any) => error?.code === code);

const base = (overrides: Record<string, unknown> = {}) => ({
  currency: "USD",
  nodes: [{ id: "fixed", method: "fixed_amount", amount: "10" }],
  rootNodeIds: ["fixed"],
  ...overrides,
});

const allMethods = evaluateGenericApu(
  base({
    nodes: [
      {
        id: "percent",
        method: "percentage_of_parent",
        parentId: "fixed",
        percent: "12.5",
      },
      {
        id: "group",
        method: "allocation_group",
        childIds: ["quantity", "hours", "percent"],
      },
      {
        id: "hours",
        method: "hours_hourly_rate",
        hours: "1.5",
        hourlyRate: "8",
      },
      { id: "fixed", method: "fixed_amount", amount: "10" },
      {
        id: "quantity",
        method: "quantity_unit_cost",
        quantity: "2",
        unitCost: "3.333",
      },
    ],
    rootNodeIds: ["fixed", "group"],
  }),
);
assert.deepEqual(
  allMethods.lines.map((line: any) => line.id),
  ["fixed", "quantity", "hours", "percent", "group"],
);
assert.deepEqual(
  allMethods.lines.map((line: any) => line.method),
  [
    "fixed_amount",
    "quantity_unit_cost",
    "hours_hourly_rate",
    "percentage_of_parent",
    "allocation_group",
  ],
);
assert.equal(
  allMethods.lines.find((line: any) => line.id === "quantity")?.rawAmount,
  "6.666",
);
assert.equal(
  allMethods.lines.find((line: any) => line.id === "quantity")?.roundedAmount,
  "6.67",
);
assert.equal(
  allMethods.lines.find((line: any) => line.id === "hours")?.rawAmount,
  "12",
);
assert.equal(
  allMethods.lines.find((line: any) => line.id === "percent")?.rawAmount,
  "1.25",
);
assert.equal(
  allMethods.lines.find((line: any) => line.id === "group")?.rawAmount,
  "19.916",
);
check(
  "five executable calculation methods evaluate in dependency order",
  "fixed, quantity/rate, hours/rate, parent percentage, and allocation group",
);

const reordered = evaluateGenericApu(
  base({
    nodes: [
      {
        id: "group",
        method: "allocation_group",
        childIds: ["quantity", "fixed"],
      },
      { id: "fixed", method: "fixed_amount", amount: "2" },
      {
        id: "quantity",
        method: "quantity_unit_cost",
        quantity: "2",
        unitCost: "4",
      },
    ],
    rootNodeIds: ["group"],
  }),
);
assert.deepEqual(
  reordered.lines.map((line: any) => line.id),
  ["fixed", "quantity", "group"],
);
assert.equal(reordered.roundedTotal, "10.00");
check("input ordering is not evaluation ordering", "stable dependency order");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        nodes: [
          { id: "a", method: "allocation_group", childIds: ["b"] },
          { id: "b", method: "allocation_group", childIds: ["a"] },
        ],
        rootNodeIds: ["a"],
      }),
    ),
  "APU_DEPENDENCY_CYCLE",
);
check("dependency cycles fail closed", "APU_DEPENDENCY_CYCLE");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        nodes: [
          {
            id: "percent",
            method: "percentage_of_parent",
            parentId: "missing",
            percent: "10",
          },
        ],
        rootNodeIds: ["percent"],
      }),
    ),
  "APU_UNKNOWN_NODE_REFERENCE",
);
throwsCode(
  () =>
    evaluateGenericApu(
      base({
        nodes: [
          { id: "group", method: "allocation_group", childIds: ["missing"] },
        ],
        rootNodeIds: ["group"],
      }),
    ),
  "APU_UNKNOWN_NODE_REFERENCE",
);
check("unknown parent and child references fail closed", "stable reference code");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        nodes: [
          {
            id: "formula",
            method: "formula",
            expression: "fixed * 2",
            formulaVersion: "1",
          },
        ],
        rootNodeIds: ["formula"],
      }),
    ),
  "APU_EVALUATION_UNSUPPORTED",
);
check("Formula remains unsupported", "no expression grammar fallback");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        nodes: [
          {
            id: "unknown-method",
            method: "industry_specific",
            amount: "1",
          },
        ],
        rootNodeIds: ["unknown-method"],
      }),
    ),
  "APU_INVALID_INPUT",
);
check("unknown industry method fails closed", "APU_INVALID_INPUT");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        nodes: [
          {
            id: "eur",
            method: "fixed_amount",
            amount: "1",
            currency: "EUR",
          },
        ],
        rootNodeIds: ["eur"],
      }),
    ),
  "APU_MIXED_CURRENCY_UNSUPPORTED",
);
check("mixed node currency fails closed", "no currency conversion fallback");

const positiveHalf = evaluateGenericApu(
  base({
    nodes: [{ id: "positive", method: "fixed_amount", amount: "1.005" }],
    rootNodeIds: ["positive"],
  }),
);
assert.equal(positiveHalf.lines[0].rawAmount, "1.005");
assert.equal(positiveHalf.lines[0].roundedAmount, "1.01");
assert.equal(positiveHalf.rawTotal, "1.005");
assert.equal(positiveHalf.roundedTotal, "1.01");
const negativeHalf = evaluateGenericApu(
  base({
    nodes: [{ id: "negative", method: "fixed_amount", amount: "-1.005" }],
    rootNodeIds: ["negative"],
  }),
);
assert.equal(negativeHalf.lines[0].rawAmount, "-1.005");
assert.equal(negativeHalf.lines[0].roundedAmount, "-1.01");
assert.equal(negativeHalf.rawTotal, "-1.005");
assert.equal(negativeHalf.roundedTotal, "-1.01");
check(
  "half-up rounds positive and negative ties away from zero",
  "raw audit decimals remain available",
);

const residual = evaluateGenericApu(
  base({
    nodes: [
      { id: "r1", method: "fixed_amount", amount: "0.004" },
      { id: "r2", method: "fixed_amount", amount: "0.004" },
    ],
    rootNodeIds: ["r1", "r2"],
  }),
);
assert.deepEqual(residual.roundingAdjustment, {
  amount: "0.01",
  currency: "USD",
  reason: "ROUNDING_RESIDUAL",
  toleranceMinorUnits: 1,
});
assert.equal(residual.rawTotal, "0.008");
assert.equal(residual.roundedTotal, "0.01");
check("rounding residual is explicit and audited", "one minor unit adjustment");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        nodes: [
          { id: "r1", method: "fixed_amount", amount: "0.004" },
          { id: "r2", method: "fixed_amount", amount: "0.004" },
          { id: "r3", method: "fixed_amount", amount: "0.004" },
          { id: "r4", method: "fixed_amount", amount: "0.004" },
        ],
        rootNodeIds: ["r1", "r2", "r3", "r4"],
        roundingResidualToleranceMinorUnits: 1,
      }),
    ),
  "APU_ROUNDING_RESIDUAL_EXCEEDED",
);
check("residual above tolerance fails closed", "two minor units exceed one");

const remaining = evaluateGenericApu(
  base({
    approvedBudget: { amount: "100", currency: "USD" },
    committed: { amount: "20", currency: "USD" },
    actualPaid: { amount: "10", currency: "USD" },
    approvedAdjustments: { amount: "5", currency: "USD" },
  }),
).remainingBudget;
assert.deepEqual(remaining, {
  available: true,
  currency: "USD",
  approvedBudget: "100",
  committed: "20",
  actualPaid: "10",
  approvedAdjustments: "5",
  value: "65",
});
check(
  "remaining budget uses the exact approved formula",
  "100 - 20 - 10 - 5 = 65",
);

const unavailableRemaining = evaluateGenericApu(
  base({ approvedBudget: { amount: "100", currency: "USD" } }),
).remainingBudget;
assert.equal(unavailableRemaining.available, false);
assert.equal(unavailableRemaining.value, null);
assert.equal(unavailableRemaining.committed, null);
assert.equal(unavailableRemaining.actualPaid, null);
assert.equal(unavailableRemaining.approvedAdjustments, null);
assert.equal(unavailableRemaining.unavailableReason, "MISSING_BASELINE");
check("remaining budget needs all four baselines", "missing fields stay null");

const capInput = (overrides: Record<string, unknown> = {}) => ({
  capAmount: { amount: "100", currency: "USD" },
  projected: { amount: "50", currency: "USD" },
  committed: { amount: "20", currency: "USD" },
  actualPaid: { amount: "10", currency: "USD" },
  ...overrides,
});
const within = evaluateGenericApu(base({ capCheck: capInput() })).cap;
assert.equal(within.state, "WITHIN_CAP");
assert.equal(within.exposure, "80");
assert.equal(within.overrun, "0");
check("cap includes projected committed and actual paid", "50 + 20 + 10");

const needsApproval = evaluateGenericApu(
  base({
    capCheck: capInput({ projected: { amount: "80", currency: "USD" } }),
  }),
).cap;
assert.equal(needsApproval.state, "NEEDS_APPROVAL");
assert.equal(needsApproval.exposure, "110");
assert.equal(needsApproval.overrun, "10");
check("over-cap exposure needs approval", "no implicit override");

const approval = {
  amount: { amount: "10", currency: "USD" },
  reason: "Approved overrun with bound Finance receipt",
  approvedBy: "user:42:receipt:apu-engine-behavior-1",
  approvedAt: "2026-08-05T12:00:00.000Z",
};
const approvedOverride = evaluateGenericApu(
  base({
    capCheck: capInput({
      projected: { amount: "80", currency: "USD" },
      approval,
    }),
  }),
).cap;
assert.equal(approvedOverride.state, "APPROVED_OVERRIDE");
assert.deepEqual(approvedOverride.approval, approval);
check("complete approval covers exact overrun", "APPROVED_OVERRIDE");

const untrustedApproval = evaluateGenericApu(
  base({
    capCheck: capInput({
      projected: { amount: "80", currency: "USD" },
      approval: {
        ...approval,
        approvedBy: "caller-asserted-approver",
      },
    }),
  }),
).cap;
assert.equal(untrustedApproval.state, "NEEDS_APPROVAL");
assert.equal(untrustedApproval.approval, undefined);
check("untrusted approval identity cannot override cap", "service receipt required");

const incompleteApproval = evaluateGenericApu(
  base({
    capCheck: capInput({
      projected: { amount: "80", currency: "USD" },
      approval: { ...approval, reason: "" },
    }),
  }),
).cap;
assert.equal(incompleteApproval.state, "NEEDS_APPROVAL");
assert.equal(incompleteApproval.approval, undefined);
check("incomplete approval does not override cap", "blank reason rejected");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        capCheck: capInput({
          projected: { amount: "80", currency: "USD" },
          approval: {
            ...approval,
            amount: { amount: "10", currency: "EUR" },
          },
        }),
      }),
    ),
  "APU_MIXED_CURRENCY_UNSUPPORTED",
);
check("approval currency mismatch fails closed", "no cross-currency override");

const window = evaluateGenericApu(
  base({
    threeMonthWindow: {
      asOfDate: "2026-08-05T00:00:00.000Z",
      entries: [
        { id: "recent-in", kind: "recent", date: "2026-07-05" },
        { id: "recent-out", kind: "recent", date: "2026-04-01" },
        { id: "forecast-in", kind: "forecast", date: "2026-09-05" },
        { id: "forecast-out", kind: "forecast", date: "2026-12-01" },
      ],
    },
  }),
).threeMonthWindow;
assert.equal(window.status, "AVAILABLE");
assert.equal(window.months, 3);
assert.equal(window.affectsEligibility, false);
assert.equal(window.asOfDate, "2026-08-05T00:00:00.000Z");
assert.deepEqual(window.recentEntryIds, ["recent-in"]);
assert.deepEqual(window.forecastEntryIds, ["forecast-in"]);
check("three-month metadata defaults to three", "recent and forecast are metadata only");

const missingWindowDates = evaluateGenericApu(
  base({
    threeMonthWindow: {
      asOfDate: "2026-08-05T00:00:00.000Z",
      entries: [{ id: "missing", kind: "recent" }],
    },
  }),
).threeMonthWindow;
assert.equal(missingWindowDates.status, "UNAVAILABLE");
assert.equal(missingWindowDates.unavailableReason, "MISSING_DATES");
assert.deepEqual(missingWindowDates.recentEntryIds, []);
assert.deepEqual(missingWindowDates.forecastEntryIds, []);
check("missing window dates remain unavailable", "no inferred timestamp");

throwsCode(
  () =>
    evaluateGenericApu(
      base({
        threeMonthWindow: {
          asOfDate: "2026-08-05T00:00:00.000Z",
          affectsEligibility: true,
          entries: [],
        },
      }),
    ),
  "APU_WINDOW_ELIGIBILITY_POLICY_UNSUPPORTED",
);
check("window cannot affect eligibility", "policy remains unsupported");

const immutableInput = base({
  nodes: [
    { id: "fixed", method: "fixed_amount", amount: "12.345" },
    {
      id: "quantity",
      method: "quantity_unit_cost",
      quantity: "2",
      unitCost: "4.5",
    },
  ],
  rootNodeIds: ["fixed", "quantity"],
  approvedBudget: { amount: "100", currency: "USD" },
  committed: { amount: "20", currency: "USD" },
  actualPaid: { amount: "10", currency: "USD" },
  approvedAdjustments: { amount: "5", currency: "USD" },
});
const before = structuredClone(immutableInput);
const first = evaluateGenericApu(immutableInput);
const second = evaluateGenericApu(immutableInput);
assert.deepEqual(immutableInput, before);
assert.deepEqual(second, first);
check("evaluation is immutable and idempotent", "repeat returns exact same result");

console.log(
  JSON.stringify(
    {
      suite: "generic-apu.behavior",
      checks: checks.length,
      passed: true,
      evidence: checks,
    },
    null,
    2,
  ),
);
