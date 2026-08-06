import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { authorizeFinancialOperation } from "./financial-control-service";
import { waitForGenericApuPersistenceMigration } from "./generic-apu-persistence-migration";
import { CostValuePlanError } from "./cost-value-plan-service";

const amountPattern = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const cents = (value: unknown, field: string) => {
  const raw = String(value ?? "").trim();
  if (!amountPattern.test(raw)) throw new CostValuePlanError(409, "COST_VALUE_FORECAST_INPUT_INVALID", `${field} is unavailable or invalid.`);
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};
const money = (value: bigint) => `${value < 0n ? "-" : ""}${(value < 0n ? -value : value) / 100n}.${((value < 0n ? -value : value) % 100n).toString().padStart(2, "0")}`;
const ratio = (numerator: bigint, denominator: bigint) => denominator === 0n ? null : (numerator * 10_000n + denominator / 2n) / denominator;
const ratioText = (value: bigint | null) => value == null ? null : `${value / 10_000n}.${(value % 10_000n).toString().padStart(4, "0")}`;
const divideMoney = (numerator: bigint, denominatorScaled: bigint) => denominatorScaled === 0n ? null : (numerator * 10_000n + denominatorScaled / 2n) / denominatorScaled;
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const bonusFactor = (forecastCpi: bigint | null) => forecastCpi == null || forecastCpi <= 6_000n ? 0n : forecastCpi >= 10_000n ? 10_000n : ((forecastCpi - 6_000n) * 10_000n + 2_000n) / 4_000n;

export function evaluateCostValueForecast(input: { plan: any; performance: any }) {
  const sellingPrice = cents(input.plan.sellingPrice, "sellingPrice");
  const fixedCompanyCost = cents(input.plan.fixedCompanyCost, "fixedCompanyCost");
  const bonusPool = cents(input.plan.allocations?.bonus, "bonusPool");
  const budgetAtCompletion = sellingPrice - fixedCompanyCost;
  if (budgetAtCompletion <= 0n) throw new CostValuePlanError(409, "COST_VALUE_FORECAST_BAC_INVALID", "Net Distributable Value must be positive before forecasting.");
  const plannedValue = cents(input.performance.plannedValue, "plannedValue");
  const earnedValue = cents(input.performance.earnedValue, "earnedValue");
  const actualCost = cents(input.performance.actualCost, "actualCost");
  const cpi = ratio(earnedValue, actualCost), spi = ratio(earnedValue, plannedValue);
  if (cpi == null || cpi === 0n) throw new CostValuePlanError(409, "COST_VALUE_FORECAST_CPI_REQUIRED", "Earned Value and Actual Cost must produce a positive CPI before forecasting.");
  const remaining = budgetAtCompletion > earnedValue ? budgetAtCompletion - earnedValue : 0n;
  const expectedEac = divideMoney(budgetAtCompletion, cpi)!;
  const optimisticEac = actualCost + remaining;
  const conservativeEfficiency = spi == null || spi === 0n ? cpi : (cpi * spi + 5_000n) / 10_000n;
  const conservativeEtc = divideMoney(remaining, conservativeEfficiency);
  const conservativeEac = conservativeEtc == null ? expectedEac : actualCost + conservativeEtc;
  const makeScenario = (name: string, eac: bigint) => {
    const etc = eac > actualCost ? eac - actualCost : 0n;
    const vac = budgetAtCompletion - eac;
    const forecastCpi = ratio(budgetAtCompletion, eac);
    const factor = bonusFactor(forecastCpi);
    return { name, eac: money(eac), etc: money(etc), vac: money(vac), forecastCpi: ratioText(forecastCpi), projectedMargin: money(sellingPrice - fixedCompanyCost - eac), projectedBonusPercent: `${factor / 100n}.${(factor % 100n).toString().padStart(2, "0")}`, projectedBonusAmount: money((bonusPool * factor + 5_000n) / 10_000n) };
  };
  const remainingBudget = budgetAtCompletion - actualCost;
  const tcpi = remainingBudget <= 0n ? null : ratio(remaining, remainingBudget);
  return {
    budgetAtCompletion: money(budgetAtCompletion),
    costVariance: money(earnedValue - actualCost),
    scheduleVariance: money(earnedValue - plannedValue),
    cpi: ratioText(cpi), spi: ratioText(spi), tcpi: ratioText(tcpi),
    status: cpi < 6_000n || (spi != null && spi < 6_000n) ? "critical" : cpi < 10_000n || (spi != null && spi < 10_000n) ? "warning" : "healthy",
    scenarios: [makeScenario("optimistic", optimisticEac), makeScenario("expected", expectedEac), makeScenario("conservative", conservativeEac)],
    assumptions: {
      optimistic: "Remaining work completes at budgeted cost.",
      expected: "Current CPI continues through completion.",
      conservative: spi == null ? "Current CPI continues; SPI is unavailable." : "Current combined CPI and SPI efficiency continues.",
    },
    evaluatorVersion: "cost-value-forecast.v1",
  };
}

export async function getCostValueForecast(actorUserId: number, projectId: number) {
  await waitForGenericApuPersistenceMigration();
  await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.view", operation: "read" });
  const rows = (await pool.query(`SELECT version,content,evaluation,content_fingerprint,created_at FROM generic_cost_value_forecast_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 24`, [projectId])).rows;
  const history = rows.map(row => ({ ...row.content, evaluation: row.evaluation, version: Number(row.version), fingerprint: row.content_fingerprint, savedAt: new Date(row.created_at).toISOString() }));
  return { data: { latest: history[0] ?? null, history } };
}

export async function saveCostValueForecast(actorUserId: number, projectId: number, input: unknown) {
  await waitForGenericApuPersistenceMigration();
  await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.prepare", operation: "prepare" });
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const label = String(raw.label ?? "").trim();
  const sourceNote = String(raw.sourceNote ?? "").trim();
  if (!label || label.length > 120 || sourceNote.length > 1_000) throw new CostValuePlanError(400, "COST_VALUE_FORECAST_INPUT_INVALID", "Forecast label or source note is invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [projectId]);
    const plan = (await client.query(`SELECT id,content FROM generic_cost_value_plan_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1 FOR SHARE`, [projectId])).rows[0];
    const performance = (await client.query(`SELECT id,content FROM generic_cost_value_performance_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1 FOR SHARE`, [projectId])).rows[0];
    if (!plan || !performance) throw new CostValuePlanError(409, "COST_VALUE_FORECAST_PREREQUISITES_REQUIRED", "Save Module 1 and Module 2 before creating a forecast.");
    const evaluation = evaluateCostValueForecast({ plan: plan.content, performance: performance.content });
    const content = { label, sourceNote, forecastDate: new Date().toISOString().slice(0, 10) };
    const fingerprint = digest({ planVersionId: plan.id, performanceVersionId: performance.id, content, evaluation });
    const prior = (await client.query(`SELECT id,version,content_fingerprint FROM generic_cost_value_forecast_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1 FOR SHARE`, [projectId])).rows[0];
    if (prior?.content_fingerprint === fingerprint) { await client.query("ROLLBACK"); return getCostValueForecast(actorUserId, projectId); }
    await client.query(`INSERT INTO generic_cost_value_forecast_versions(id,project_id,plan_version_id,performance_version_id,version,content,evaluation,content_fingerprint,supersedes_id,created_by_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)`, [crypto.randomUUID(), projectId, plan.id, performance.id, Number(prior?.version ?? 0) + 1, JSON.stringify(content), JSON.stringify(evaluation), fingerprint, prior?.id ?? null, actorUserId]);
    await client.query("COMMIT");
    return getCostValueForecast(actorUserId, projectId);
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}

export async function exportCostValueForecastCsv(actorUserId: number, projectId: number) {
  const result = await getCostValueForecast(actorUserId, projectId), quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const header = ["version","forecast_date","label","status","scenario","bac","cpi","spi","tcpi","cv","sv","eac","etc","vac","forecast_cpi","projected_margin","projected_bonus_percent","projected_bonus_amount","source_note"];
  const lines = result.data.history.flatMap((row: any) => row.evaluation.scenarios.map((scenario: any) => [row.version,row.forecastDate,row.label,row.evaluation.status,scenario.name,row.evaluation.budgetAtCompletion,row.evaluation.cpi,row.evaluation.spi,row.evaluation.tcpi,row.evaluation.costVariance,row.evaluation.scheduleVariance,scenario.eac,scenario.etc,scenario.vac,scenario.forecastCpi,scenario.projectedMargin,scenario.projectedBonusPercent,scenario.projectedBonusAmount,row.sourceNote].map(quote).join(",")));
  return `${header.join(",")}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}
