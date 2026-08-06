import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ?? "postgresql://apu-test:apu-test@127.0.0.1:1/apu-test";
const { evaluateCostValueForecast } = await import("./cost-value-forecast-service");
const result = evaluateCostValueForecast({ plan: { sellingPrice: "1000.00", fixedCompanyCost: "100.00", allocations: { bonus: "100.00" } }, performance: { plannedValue: "400.00", earnedValue: "360.00", actualCost: "400.00" } });
assert.equal(result.budgetAtCompletion, "900.00");
assert.equal(result.cpi, "0.9000"); assert.equal(result.spi, "0.9000"); assert.equal(result.tcpi, "1.0800");
assert.equal(result.costVariance, "-40.00"); assert.equal(result.scheduleVariance, "-40.00"); assert.equal(result.status, "warning");
assert.deepEqual(result.scenarios.map((scenario: any) => scenario.name), ["optimistic", "expected", "conservative"]);
assert.equal(result.scenarios[0].eac, "940.00"); assert.equal(result.scenarios[1].eac, "1000.00"); assert.equal(result.scenarios[1].vac, "-100.00"); assert.equal(result.scenarios[2].eac, "1066.67"); assert.equal(result.scenarios[1].projectedBonusPercent, "75.00");
const root = path.resolve(import.meta.dirname, "../../../.."), migration = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/generic-apu-persistence-migration.ts"), "utf8"), routes = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/financial-apu.ts"), "utf8"), ui = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/FinancialApuWorkspace.tsx"), "utf8");
assert.match(migration, /CREATE TABLE IF NOT EXISTS generic_cost_value_forecast_versions/); assert.match(migration, /generic_cost_value_forecast_versions_immutable/);
assert.match(routes, /financial\/apu\/forecast/); assert.match(routes, /financial\/apu\/forecast\.csv/); assert.match(ui, /Forecasting & Early Warning/); assert.match(ui, /No AI is used in this layer/);
console.log("Cost & Value Forecast Layer 1 validation: passed.");
