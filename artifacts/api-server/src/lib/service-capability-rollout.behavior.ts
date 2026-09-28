import assert from "node:assert/strict";
import { resolveServiceCapabilityRollout } from "./service-capability-rollout";
import type { EntitlementDecision } from "./entitlement-contract";

const decision = (featureKey: string, allowed: boolean): EntitlementDecision => ({
  decision: allowed ? "allow" : "deny",
  state: allowed ? "available" : "project_disabled",
  code: allowed ? "ENT_AVAILABLE" : "ENT_PROJECT_DISABLED",
  featureKey,
  explanation: { en: "test", es: "prueba" },
  sources: [{ authority: "authenticated_user", id: "user:current", version: 1 }],
  evaluatedAt: "2026-09-28T00:00:00.000Z",
  evaluation: { mode: "advisory_read_only", authorizesExecution: false },
});

const unchanged = resolveServiceCapabilityRollout({
  presetKey: "coordination-core",
  decisions: { "rfi.core": decision("rfi.core", true), "navisworks.lens": decision("navisworks.lens", true) },
  currentAuthorities: [],
});
assert.deepEqual(unchanged.map((row) => [row.featureKey, row.active, row.reason]), [
  ["rfi.core", true, "allowed"],
  ["navisworks.lens", false, "not_selected"],
]);

const protectedLens = resolveServiceCapabilityRollout({
  presetKey: "coordination-with-lens",
  decisions: { "rfi.core": decision("rfi.core", true), "navisworks.lens": decision("navisworks.lens", false) },
  currentAuthorities: [],
});
assert.equal(protectedLens.find((row) => row.featureKey === "navisworks.lens")?.active, false);
assert.equal(protectedLens.find((row) => row.featureKey === "navisworks.lens")?.reason, "denied");
assert.throws(() => resolveServiceCapabilityRollout({ presetKey: "unknown", decisions: {}, currentAuthorities: [] }), /SERVICE_PRESET_UNKNOWN/);

console.log("C021 service capability rollout: PASS");
