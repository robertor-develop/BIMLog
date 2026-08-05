import assert from "node:assert/strict";
import { evaluateGenericApu } from "./generic-apu-engine";

const base = (overrides: Record<string, unknown> = {}) => ({
  currency: "USD",
  nodes: [{ id: "fixed", method: "fixed_amount", amount: "10" }],
  rootNodeIds: ["fixed"],
  ...overrides,
});

const rejectsInvalidInput = (input: unknown) =>
  assert.throws(
    () => evaluateGenericApu(input as never),
    (error: any) => error?.code === "APU_INVALID_INPUT",
  );

rejectsInvalidInput({ ...base(), injectedAuthority: true });
rejectsInvalidInput(
  base({
    approvedBudget: { amount: "10", currency: "USD", derived: true },
  }),
);
rejectsInvalidInput(
  base({
    capCheck: {
      capAmount: { amount: "10", currency: "USD" },
      projected: { amount: "1", currency: "USD" },
      committed: { amount: "1", currency: "USD" },
      actualPaid: { amount: "1", currency: "USD" },
      bypass: true,
    },
  }),
);
rejectsInvalidInput(
  base({
    threeMonthWindow: {
      asOfDate: "2026-08-05",
      entries: [{ id: "one", kind: "recent", date: "2026-08-01", inferred: true }],
    },
  }),
);

rejectsInvalidInput(
  base({
    nodes: [{ id: "empty", method: "allocation_group", childIds: [] }],
    rootNodeIds: ["empty"],
  }),
);
rejectsInvalidInput(
  base({
    threeMonthWindow: {
      asOfDate: "2026-08-05",
      entries: [
        { id: "duplicate", kind: "recent", date: "2026-08-01" },
        { id: "duplicate", kind: "forecast", date: "2026-08-06" },
      ],
    },
  }),
);

rejectsInvalidInput(
  base({
    nodes: [
      {
        id: "overflow",
        method: "quantity_unit_cost",
        quantity: "999999999999999999999999",
        unitCost: "999999999999999999999999",
      },
    ],
    rootNodeIds: ["overflow"],
  }),
);

console.log(
  JSON.stringify({
    suite: "generic-apu-engine-edge.behavior",
    status: "PASS",
    closedShapeDenials: 4,
    structuralDenials: 2,
    arithmeticOverflowDenials: 1,
    databaseNetworkBrowserIo: false,
  }),
);
