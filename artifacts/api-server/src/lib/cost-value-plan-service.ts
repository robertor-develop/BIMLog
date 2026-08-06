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
  const labor = cents(raw.allocations?.labor, "allocations.labor");
  const bonus = cents(raw.allocations?.bonus, "allocations.bonus");
  const taskEarnings = cents(raw.allocations?.taskEarnings, "allocations.taskEarnings");
  const production = cents(raw.laborSplit?.production, "laborSplit.production");
  const administrative = cents(raw.laborSplit?.administrative, "laborSplit.administrative");
  const phases = lineList(raw.productionPhases, "productionPhases");
  const adminLines = lineList(raw.administrativeLines, "administrativeLines");
  if (labor + bonus + taskEarnings !== net)
    throw new CostValuePlanError(400, "COST_VALUE_ALLOCATION_UNBALANCED", "Labor, bonus, and task earnings must equal Net Distributable Value.");
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
    { id: "labor", name: "Labor", amount: money(labor) },
    { id: "bonus", name: "Bonus", amount: money(bonus) },
    { id: "task-earnings", name: "Task Earnings", amount: money(taskEarnings) },
  ]);
  const phaseResult = evaluate(phases);
  const administrativeResult = evaluate(adminLines);
  const plan: CostValuePlanInput = {
    name: text(raw.name, "name"), currency,
    sellingPrice: money(selling), fixedCompanyCost: money(fixed),
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
  await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.budget.view", operation: "read" });
  const project = (await pool.query(`SELECT id,name,code FROM projects WHERE id=$1`, [projectId])).rows[0];
  if (!project) throw new CostValuePlanError(404, "PROJECT_NOT_FOUND", "Project not found.");
  const latest = (await pool.query(`SELECT version,content,evaluation,content_fingerprint,created_at FROM generic_cost_value_plan_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1`, [projectId])).rows[0] ?? null;
  return { data: { project: { id: Number(project.id), name: project.name, code: project.code }, plan: latest ? {
    ...latest.content, evaluation: latest.evaluation, version: Number(latest.version), fingerprint: latest.content_fingerprint, savedAt: new Date(latest.created_at).toISOString(),
  } : null, commercialAccess: true } };
}

export async function saveCostValuePlan(actorUserId: number, projectId: number, input: unknown) {
  await waitForGenericApuPersistenceMigration();
  await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.budget.prepare", operation: "prepare" });
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
