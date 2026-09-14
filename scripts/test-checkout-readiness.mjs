import assert from "node:assert/strict";
import { evaluateCheckoutReadiness } from "./check-checkout-readiness.mjs";

assert.deepEqual(
  evaluateCheckoutReadiness({ branch: "release", statusLines: [], headTree: "same", authorityTree: "same" }),
  { ready: true, branch: "release", reasons: [] },
);
assert.deepEqual(
  evaluateCheckoutReadiness({ branch: "", statusLines: [" M source.ts"], headTree: "old", authorityTree: "new" }),
  {
    ready: false,
    branch: null,
    reasons: ["detached_head", "working_tree_dirty", "source_tree_not_authoritative"],
  },
);
console.log("Checkout readiness behavior: PASS");
