import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { authorizeFinancialOperation } from "./financial-control-service";
import { waitForGenericApuPersistenceMigration } from "./generic-apu-persistence-migration";
import { CostValuePlanError } from "./cost-value-plan-service";
import { performanceProvenance } from "./cost-value-performance-provenance";
import { financialCsvCell, isFinancialCalendarDate } from "./financial-export-contract";
import { approvedLaborEvidenceSql, buildApprovedLaborEvidence, type ApprovedLaborSource } from "./approved-labor-evidence";

export type CostValuePerformanceInput = {
  snapshotDate: string;
  label: string;
  plannedValue: string;
  earnedValue: string;
  actualCost: string;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  sourceNote: string;
};

const amountPattern = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const cents = (value: unknown, field: string) => {
  const raw = String(value ?? "").trim();
  if (!amountPattern.test(raw)) throw new CostValuePlanError(400, "COST_VALUE_PERFORMANCE_AMOUNT_INVALID", `${field} must be a non-negative amount with at most two decimals.`);
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};
const money = (value: bigint) => `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
const boundedText = (value: unknown, field: string, max: number, required = true) => {
  const result = String(value ?? "").trim();
  if ((required && !result) || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) {
    throw new CostValuePlanError(400, "COST_VALUE_PERFORMANCE_INPUT_INVALID", `${field} is invalid.`);
  }
  return result;
};
const date = (value: unknown, field: string, required: boolean): string | null => {
  const result = String(value ?? "").trim();
  if (!result && !required) return null;
  if (!isFinancialCalendarDate(result)) {
    throw new CostValuePlanError(400, "COST_VALUE_PERFORMANCE_DATE_INVALID", `${field} must be a valid ISO date.`);
  }
  return result;
};
const roundedRatio = (numerator: bigint, denominator: bigint): bigint | null => denominator === 0n
  ? null
  : (numerator * 10_000n + denominator / 2n) / denominator;
const ratioText = (value: bigint | null) => value == null
  ? null
  : `${value / 10_000n}.${(value % 10_000n).toString().padStart(4, "0")}`;
const percentText = (basisPoints: bigint) => `${basisPoints / 100n}.${(basisPoints % 100n).toString().padStart(2, "0")}`;
const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function validateCostValuePerformance(
  input: unknown,
  bonusPoolAmount: string,
): { snapshot: CostValuePerformanceInput; evaluation: Record<string, unknown> } {
  if (!input || typeof input !== "object") throw new CostValuePlanError(400, "COST_VALUE_PERFORMANCE_INPUT_INVALID", "A performance snapshot is required.");
  const raw = input as Record<string, unknown>;
  const snapshotDate = date(raw.snapshotDate, "snapshotDate", true)!;
  const baselineStartDate = date(raw.baselineStartDate, "baselineStartDate", false);
  const baselineEndDate = date(raw.baselineEndDate, "baselineEndDate", false);
  if ((baselineStartDate === null) !== (baselineEndDate === null)) {
    throw new CostValuePlanError(400, "COST_VALUE_PERFORMANCE_BASELINE_INCOMPLETE", "Both baseline dates are required for SPI.");
  }
  if (baselineStartDate && baselineEndDate && baselineStartDate > baselineEndDate) {
    throw new CostValuePlanError(400, "COST_VALUE_PERFORMANCE_BASELINE_INVALID", "Baseline end must not precede baseline start.");
  }
  const plannedValue = cents(raw.plannedValue, "plannedValue");
  const earnedValue = cents(raw.earnedValue, "earnedValue");
  const actualCost = cents(raw.actualCost, "actualCost");
  const bonusPool = cents(bonusPoolAmount, "bonusPool");
  const cpiScaled = roundedRatio(earnedValue, actualCost);
  const spiScaled = baselineStartDate && baselineEndDate ? roundedRatio(earnedValue, plannedValue) : null;
  const noPayoutThreshold = 6_000n;
  const fullPayoutThreshold = 10_000n;
  const bonusFactor = cpiScaled == null || cpiScaled <= noPayoutThreshold
    ? 0n
    : cpiScaled >= fullPayoutThreshold
      ? 10_000n
      : ((cpiScaled - noPayoutThreshold) * 10_000n + 2_000n) / 4_000n;
  const eligibleBonus = (bonusPool * bonusFactor + 5_000n) / 10_000n;
  const snapshot: CostValuePerformanceInput = {
    snapshotDate,
    label: boundedText(raw.label, "label", 120),
    plannedValue: money(plannedValue),
    earnedValue: money(earnedValue),
    actualCost: money(actualCost),
    baselineStartDate,
    baselineEndDate,
    sourceNote: boundedText(raw.sourceNote, "sourceNote", 1_000, false),
  };
  return {
    snapshot,
    evaluation: {
      cpi: ratioText(cpiScaled),
      cpiStatus: cpiScaled == null ? "unavailable" : cpiScaled >= 10_000n ? "on_or_above_plan" : cpiScaled > 6_000n ? "below_plan" : "critical",
      spi: ratioText(spiScaled),
      spiStatus: spiScaled == null ? "unavailable" : spiScaled >= 10_000n ? "on_or_ahead" : "behind",
      spiAvailabilityReason: spiScaled == null ? (baselineStartDate ? "planned_value_is_zero" : "credible_baseline_required") : null,
      bonusPool: money(bonusPool),
      bonusPayoutPercent: percentText(bonusFactor),
      bonusEligibleAmount: money(eligibleBonus),
      bonusPolicy: { fullPayoutAtOrAboveCpi: "1.0000", noPayoutAtOrBelowCpi: "0.6000", interpolation: "linear" },
      evaluatorVersion: "cost-value-performance.v1",
    },
  };
}

export async function getCostValuePerformance(actorUserId: number, projectId: number) {
  await waitForGenericApuPersistenceMigration();
  await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.view", operation: "read" });
  const project = (await pool.query(`SELECT id,name,code FROM projects WHERE id=$1`, [projectId])).rows[0];
  if (!project) throw new CostValuePlanError(404, "PROJECT_NOT_FOUND", "Project not found.");
  const rows = (await pool.query(`SELECT s.version,s.content,(s.evaluation #- '{approvedLaborEvidence,sources}') AS evaluation,s.content_fingerprint,s.created_at,
    p.id AS plan_id,p.version AS plan_version,p.content_fingerprint AS plan_fingerprint,p.content AS plan_content
    FROM generic_cost_value_performance_versions s
    JOIN generic_cost_value_plan_versions p ON p.id=s.plan_version_id AND p.project_id=s.project_id
    WHERE s.project_id=$1 ORDER BY s.version DESC LIMIT 24`, [projectId])).rows;
  const snapshots = rows.map(row => ({ ...row.content, evaluation: row.evaluation,
    provenance: performanceProvenance({id:row.plan_id,version:row.plan_version,content_fingerprint:row.plan_fingerprint,content:row.plan_content}),
    version: Number(row.version), fingerprint: row.content_fingerprint, savedAt: new Date(row.created_at).toISOString() }));
  return { data: { project: { id: Number(project.id), name: project.name, code: project.code }, latest: snapshots[0] ?? null, history: snapshots } };
}

export async function saveCostValuePerformance(actorUserId: number, projectId: number, input: unknown) {
  await waitForGenericApuPersistenceMigration();
  const authority = await authorizeFinancialOperation({ actorUserId, projectId, featureKey: "cost.value_planner.prepare", operation: "prepare" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [projectId]);
    const plan = (await client.query(`SELECT id,content FROM generic_cost_value_plan_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1 FOR SHARE`, [projectId])).rows[0];
    if (!plan) throw new CostValuePlanError(409, "COST_VALUE_PLAN_REQUIRED", "Save the Cost & Value Plan before recording performance.");
    const bonusPool = String(plan.content?.allocations?.bonus ?? "");
    const { snapshot, evaluation } = validateCostValuePerformance(input, bonusPool);
    // Keep entered scenario values separate from server-resolved, frozen approval evidence.
    const laborRows = (await client.query<ApprovedLaborSource>(approvedLaborEvidenceSql,
      [projectId,authority.scope.companyId,snapshot.snapshotDate])).rows;
    try {
      evaluation.approvedLaborEvidence = buildApprovedLaborEvidence(laborRows,String(plan.content?.currency ?? ""),snapshot.snapshotDate);
    } catch (error) {
      const code = error instanceof Error ? error.message : "APPROVED_LABOR_PROVENANCE_MISSING";
      throw new CostValuePlanError(409,code,"Approved labor evidence could not be reconciled. Review its currency and source records before saving.");
    }
    const prior = (await client.query(`SELECT id,version,content_fingerprint FROM generic_cost_value_performance_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1 FOR SHARE`, [projectId])).rows[0] ?? null;
    const fingerprint = digest({ planVersionId: plan.id, snapshot, evaluation });
    if (prior?.content_fingerprint === fingerprint) {
      await client.query("ROLLBACK");
      return getCostValuePerformance(actorUserId, projectId);
    }
    const version = Number(prior?.version ?? 0) + 1;
    await client.query(`INSERT INTO generic_cost_value_performance_versions(id,project_id,plan_version_id,version,content,evaluation,content_fingerprint,supersedes_id,created_by_id) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`, [crypto.randomUUID(), projectId, plan.id, version, JSON.stringify(snapshot), JSON.stringify(evaluation), fingerprint, prior?.id ?? null, actorUserId]);
    await client.query("COMMIT");
    return getCostValuePerformance(actorUserId, projectId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function exportCostValuePerformanceCsv(actorUserId: number, projectId: number) {
  const result = await getCostValuePerformance(actorUserId, projectId);
  const quote = financialCsvCell;
  const header = ["project_code","project_name","version","snapshot_date","label","planned_value","earned_value","actual_cost","cpi","spi","bonus_pool","scenario_eligibility_percent","scenario_bonus_estimate","source_note","classification","currency","plan_version","plan_fingerprint","payment_authorized","approved_labor_cost","approved_labor_hours","approved_labor_source_count","approved_labor_fingerprint"];
  const lines = result.data.history.map((row: any) => [result.data.project.code,result.data.project.name,row.version,row.snapshotDate,row.label,row.plannedValue,row.earnedValue,row.actualCost,row.evaluation.cpi,row.evaluation.spi,row.evaluation.bonusPool,row.evaluation.bonusPayoutPercent,row.evaluation.bonusEligibleAmount,row.sourceNote,row.provenance.classification,row.provenance.currency,row.provenance.planVersion,row.provenance.planFingerprint,row.provenance.paymentAuthorized,row.evaluation.approvedLaborEvidence?.amount,row.evaluation.approvedLaborEvidence?.hours,row.evaluation.approvedLaborEvidence?.sourceCount,row.evaluation.approvedLaborEvidence?.fingerprint].map(quote).join(","));
  return `${header.join(",")}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}
