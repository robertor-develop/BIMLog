import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { authorizeFinancialOperation } from "./financial-control-service";
import { evaluateGenericApu } from "./generic-apu-engine";
import { waitForGenericApuPersistenceMigration } from "./generic-apu-persistence-migration";

type Line = { id: string; name: string; amount: string };
export type CostValuePlanInput = {
  name: string;
  currency: string;
  sellingPrice: string;
  fixedCompanyCost: string;
  allocationMode: "amount" | "percentage";
  allocationPercentages: { labor: string; bonus: string; taskEarnings: string };
  allocations: { labor: string; bonus: string; taskEarnings: string };
  laborSplit: { production: string; administrative: string };
  productionPhases: Line[];
  administrativeLines: Line[];
};

export class CostValuePlanError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const amountPattern = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const percentPattern = /^(?:0|[1-9]\d?|100)(?:\.\d{1,2})?$/;
const text = (value: unknown, field: string, max = 120) => {
  const result = String(value ?? "").trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result))
    throw new CostValuePlanError(400, "COST_VALUE_INPUT_INVALID", `${field} is required.`);
  return result;
};
const cents = (value: unknown, field: string) => {
  const raw = String(value ?? "").trim();
  if (!amountPattern.test(raw))
    throw new CostValuePlanError(400, "COST_VALUE_AMOUNT_INVALID", `${field} must be a non-negative amount with at most two decimals.`);
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};
const money = (value: bigint) => `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
const basisPoints = (value: unknown, field: string) => {
  const raw = String(value ?? "").trim();
  if (!percentPattern.test(raw)) throw new CostValuePlanError(400, "COST_VALUE_PERCENT_INVALID", `${field} must be a percentage from 0 to 100 with at most two decimals.`);
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};
const percentText = (value: bigint) => `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
const percentageOf = (part: bigint, whole: bigint) => whole === 0n ? 0n : (part * 10_000n + whole / 2n) / whole;
const lineList = (value: unknown, field: string): Line[] => {
  if (!Array.isArray(value) || value.length > 100)
    throw new CostValuePlanError(400, "COST_VALUE_LINES_INVALID", `${field} must be a bounded list.`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object")
      throw new CostValuePlanError(400, "COST_VALUE_LINES_INVALID", `${field}[${index}] is invalid.`);
    const row = entry as Record<string, unknown>;
    const id = text(row.id, `${field}[${index}].id`, 80);
    if (ids.has(id)) throw new CostValuePlanError(400, "COST_VALUE_LINES_INVALID", `${field} contains a duplicate id.`);
    ids.add(id);
    return { id, name: text(row.name, `${field}[${index}].name`), amount: money(cents(row.amount, `${field}[${index}].amount`)) };
  });
};
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function validateCostValuePlan(input: unknown): { plan: CostValuePlanInput; evaluation: Record<string, unknown> } {
  if (!input || typeof input !== "object") throw new CostValuePlanError(400, "COST_VALUE_INPUT_INVALID", "A plan is required.");
  const raw = input as Record<string, any>;
  const currency = String(raw.currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new CostValuePlanError(400, "COST_VALUE_CURRENCY_INVALID", "A three-letter currency is required.");
  const selling = cents(raw.sellingPrice, "sellingPrice");
  const fixed = cents(raw.fixedCompanyCost, "fixedCompanyCost");
  if (fixed > selling) throw new CostValuePlanError(400, "COST_VALUE_NEGATIVE_DISTRIBUTABLE", "Fixed company cost cannot exceed selling price.");
  const net = selling - fixed;
  const allocationMode = raw.allocationMode === "percentage" ? "percentage" : "amount";
  let labor: bigint, bonus: bigint, taskEarnings: bigint;
  let allocationPercentages = { labor: "0.00", bonus: "0.00", taskEarnings: "0.00" };
  if (allocationMode === "percentage") {
    const laborPercent = basisPoints(raw.allocationPercentages?.labor, "allocationPercentages.labor");
    const bonusPercent = basisPoints(raw.allocationPercentages?.bonus, "allocationPercentages.bonus");
    const taskPercent = basisPoints(raw.allocationPercentages?.taskEarnings, "allocationPercentages.taskEarnings");
    if (laborPercent + bonusPercent + taskPercent !== 10_000n) throw new CostValuePlanError(400, "COST_VALUE_PERCENT_UNBALANCED", "Labor, bonus, and task earnings percentages must equal 100.00%.");
    labor = (net * laborPercent + 5_000n) / 10_000n;
    bonus = (net * bonusPercent + 5_000n) / 10_000n;
    taskEarnings = net - labor - bonus;
    allocationPercentages = { labor: percentText(laborPercent), bonus: percentText(bonusPercent), taskEarnings: percentText(taskPercent) };
  } else {
    labor = cents(raw.allocations?.labor, "allocations.labor");
    bonus = cents(raw.allocations?.bonus, "allocations.bonus");
    taskEarnings = cents(raw.allocations?.taskEarnings, "allocations.taskEarnings");
    if (net > 0n) {
      const laborPercent = percentageOf(labor, net);
      const bonusPercent = percentageOf(bonus, net);
      const taskPercent = laborPercent + bonusPercent <= 10_000n ? 10_000n - laborPercent - bonusPercent : percentageOf(taskEarnings, net);
      allocationPercentages = { labor: percentText(laborPercent), bonus: percentText(bonusPercent), taskEarnings: percentText(taskPercent) };
    }
  }
  const production = cents(raw.laborSplit?.production, "laborSplit.production");
  const administrative = cents(raw.laborSplit?.administrative, "laborSplit.administrative");
  const phases = lineList(raw.productionPhases, "productionPhases");
  const adminLines = lineList(raw.administrativeLines, "administrativeLines");
  if (labor + bonus + taskEarnings !== net)
    throw new CostValuePlanError(400, "COST_VALUE_ALLOCATION_UNBALANCED", "Labor Operating Pool, Project Incentive Reserve, and Project Earnings must equal Net Distributable Value.");
  if (production + administrative !== labor)
    throw new CostValuePlanError(400, "COST_VALUE_LABOR_UNBALANCED", "Production and administrative labor must equal Labor.");
  if (sum(phases.map((line) => cents(line.amount, "productionPhases.amount"))) !== production)
    throw new CostValuePlanError(400, "COST_VALUE_PHASES_UNBALANCED", "Production phases must equal Production labor.");
  if (sum(adminLines.map((line) => cents(line.amount, "administrativeLines.amount"))) !== administrative)
    throw new CostValuePlanError(400, "COST_VALUE_ADMIN_UNBALANCED", "Administrative budget lines must equal Administrative labor.");

  const evaluate = (lines: Line[]) => lines.length === 0 ? { roundedTotal: "0.00" } : evaluateGenericApu({
    currency,
    nodes: lines.map((line) => ({ id: line.id, label: line.name, method: "fixed_amount" as const, amount: line.amount })),
    rootNodeIds: lines.map((line) => line.id),
  });
  const allocationResult = evaluate([
    { id: "labor", name: "Labor Operating Pool", amount: money(labor) },
    { id: "bonus", name: "Project Incentive Reserve", amount: money(bonus) },
    { id: "task-earnings", name: "Project Earnings", amount: money(taskEarnings) },
  ]);
  const phaseResult = evaluate(phases);
  const administrativeResult = evaluate(adminLines);
  const plan: CostValuePlanInput = {
    name: text(raw.name, "name"), currency,
    sellingPrice: money(selling), fixedCompanyCost: money(fixed),
    allocationMode, allocationPercentages,
    allocations: { labor: money(labor), bonus: money(bonus), taskEarnings: money(taskEarnings) },
    laborSplit: { production: money(production), administrative: money(administrative) },
    productionPhases: phases, administrativeLines: adminLines,
  };
  return { plan, evaluation: {
    netDistributableValue: money(net),
    allocationTotal: allocationResult.roundedTotal,
    productionPhaseTotal: phaseResult.roundedTotal,
    administrativeLineTotal: administrativeResult.roundedTotal,
    evaluatorVersion: "apu-evaluator.v1",
  } };
}

export async function getCostValuePlan(actorUserId: number, projectId: number) {
  await waitForGenericApuPersistenceMigration();
  await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.view", operation: "read" });
  const project = (await pool.query(`SELECT id,name,code FROM projects WHERE id=$1`, [projectId])).rows[0];
  if (!project) throw new CostValuePlanError(404, "PROJECT_NOT_FOUND", "Project not found.");
  const latest = (await pool.query(`SELECT version,content,evaluation,content_fingerprint,created_at FROM generic_cost_value_plan_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1`, [projectId])).rows[0] ?? null;
  return { data: { project: { id: Number(project.id), name: project.name, code: project.code }, plan: latest ? {
    ...latest.content, evaluation: latest.evaluation, version: Number(latest.version), fingerprint: latest.content_fingerprint, savedAt: new Date(latest.created_at).toISOString(),
  } : null, commercialAccess: true } };
}

export async function saveCostValuePlan(actorUserId: number, projectId: number, input: unknown) {
  await waitForGenericApuPersistenceMigration();
  await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.prepare", operation: "prepare" });
  const { plan, evaluation } = validateCostValuePlan(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [projectId]);
    const prior = (await client.query(`SELECT id,version,content_fingerprint FROM generic_cost_value_plan_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1 FOR SHARE`, [projectId])).rows[0] ?? null;
    const fingerprint = digest({ plan, evaluation });
    if (prior?.content_fingerprint === fingerprint) {
      await client.query("ROLLBACK");
      return getCostValuePlan(actorUserId, projectId);
    }
    const version = Number(prior?.version ?? 0) + 1;
    await client.query(`INSERT INTO generic_cost_value_plan_versions(id,project_id,version,content,evaluation,content_fingerprint,supersedes_id,created_by_id) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8)`, [crypto.randomUUID(), projectId, version, JSON.stringify(plan), JSON.stringify(evaluation), fingerprint, prior?.id ?? null, actorUserId]);
    await client.query("COMMIT");
    return getCostValuePlan(actorUserId, projectId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
