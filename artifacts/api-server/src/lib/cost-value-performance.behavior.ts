import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ?? "postgresql://apu-test:apu-test@127.0.0.1:1/apu-test";
const { CostValuePlanError } = await import("./cost-value-plan-service");
const { validateCostValuePerformance } = await import("./cost-value-performance-service");

const snapshot = {
  snapshotDate: "2026-08-06",
  label: "August earned-value review",
  plannedValue: "800.00",
  earnedValue: "800.00",
  actualCost: "800.00",
  baselineStartDate: "2026-01-01",
  baselineEndDate: "2026-12-31",
  sourceNote: "Approved monthly cost report",
};

const full = validateCostValuePerformance(snapshot, "100.00");
assert.equal(full.evaluation.cpi, "1.0000");
assert.equal(full.evaluation.spi, "1.0000");
assert.equal(full.evaluation.bonusPayoutPercent, "100.00");
assert.equal(full.evaluation.bonusEligibleAmount, "100.00");

const weighted = validateCostValuePerformance({ ...snapshot, earnedValue: "640.00" }, "100.00");
assert.equal(weighted.evaluation.cpi, "0.8000");
assert.equal(weighted.evaluation.bonusPayoutPercent, "50.00");
assert.equal(weighted.evaluation.bonusEligibleAmount, "50.00");

const none = validateCostValuePerformance({ ...snapshot, earnedValue: "480.00" }, "100.00");
assert.equal(none.evaluation.cpi, "0.6000");
assert.equal(none.evaluation.bonusPayoutPercent, "0.00");
assert.equal(none.evaluation.bonusEligibleAmount, "0.00");

const noSchedule = validateCostValuePerformance({ ...snapshot, baselineStartDate: null, baselineEndDate: null }, "100.00");
assert.equal(noSchedule.evaluation.spi, null);
assert.equal(noSchedule.evaluation.spiAvailabilityReason, "credible_baseline_required");

assert.throws(
  () => validateCostValuePerformance({ ...snapshot, baselineEndDate: null }, "100.00"),
  (error: unknown) => error instanceof CostValuePlanError && error.code === "COST_VALUE_PERFORMANCE_BASELINE_INCOMPLETE",
);
assert.throws(
  () => validateCostValuePerformance({ ...snapshot, actualCost: "-1.00" }, "100.00"),
  (error: unknown) => error instanceof CostValuePlanError && error.code === "COST_VALUE_PERFORMANCE_AMOUNT_INVALID",
);

const root = path.resolve("../..");
const schema = fs.readFileSync(path.join(root, "lib/db/src/schema/generic-apu.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/generic-apu-persistence-migration.ts"), "utf8");
const routes = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/financial-apu.ts"), "utf8");
assert.match(schema, /genericCostValuePerformanceVersionsTable/);
assert.match(migration, /generic_cost_value_performance_versions_immutable/);
assert.match(routes, /financial\/apu\/performance\.csv/);

console.log("Cost & Value Performance validation: passed.");
