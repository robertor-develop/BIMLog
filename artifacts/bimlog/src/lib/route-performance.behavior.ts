import assert from "node:assert/strict";
import { percentile, summarizeRouteSamples } from "./route-performance.ts";

assert.equal(percentile([], .95), null);
assert.equal(percentile([120, 20, 80, 40], .5), 40);
assert.equal(percentile([120, 20, 80, 40], .95), 120);
assert.deepEqual(summarizeRouteSamples([
  { route: "/a", durationMs: 20, outcome: "ready" },
  { route: "/a", durationMs: 999, outcome: "timeout" },
]), { count: 2, completed: 1, p50: 20, p95: 20 });
console.log("ROUTE_PERFORMANCE_RESULT=PASS p50/p95 exclude incomplete requests");
