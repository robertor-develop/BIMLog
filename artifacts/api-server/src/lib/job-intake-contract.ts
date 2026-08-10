import crypto from "node:crypto";
import { FinancialControlError } from "./financial-control-contract";
import { boundedText, decimalFromScaled, scaledSignedDecimal } from "./financial-budget-contract";
import { contractCurrency, exactPositiveAmount } from "./financial-contract-contract";

export const JOB_INTAKE_STAGES = ["documents", "identity", "scope", "pricing", "contract", "delivery", "team", "review"] as const;
export type JobIntakeStage = typeof JOB_INTAKE_STAGES[number];

const optionalText = (value: unknown, field: string, max = 1000) => value == null || String(value).trim() === "" ? "" : boundedText(value, field, 1, max);
const optionalId = (value: unknown, field: string) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new FinancialControlError(400, "JOB_INTAKE_ID_INVALID", `${field} must be a positive identifier.`);
  return parsed;
};
const bool = (value: unknown) => value === true;
const exact = (value: unknown, field: string) => value == null || value === "" ? "0" : exactPositiveAmount(String(value), field);
const positive = (value: string) => scaledSignedDecimal(value) > 0n;

export type JobIntakeData = ReturnType<typeof normalizeJobIntakeData>;

export function normalizeJobIntakeData(raw: unknown) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, any> : {};
  const identity = input.identity && typeof input.identity === "object" ? input.identity : {};
  const commercial = input.commercial && typeof input.commercial === "object" ? input.commercial : {};
  const delivery = input.delivery && typeof input.delivery === "object" ? input.delivery : {};
  const team = input.team && typeof input.team === "object" ? input.team : {};
  const review = input.review && typeof input.review === "object" ? input.review : {};
  const scopeItems = Array.isArray(input.scopeItems) ? input.scopeItems : [];
  const assignments = Array.isArray(team.assignments) ? team.assignments : [];
  if (scopeItems.length > 500) throw new FinancialControlError(400, "JOB_INTAKE_SCOPE_LIMIT", "No more than 500 scope items are accepted.");
  if (assignments.length > 500) throw new FinancialControlError(400, "JOB_INTAKE_ASSIGNMENT_LIMIT", "No more than 500 assignments are accepted.");
  const normalizedItems = scopeItems.map((rawItem: any, index: number) => {
    const item = rawItem && typeof rawItem === "object" ? rawItem : {};
    const plannedHours = exact(item.plannedHours, `scopeItems[${index}].plannedHours`);
    const billingHourlyRate = exact(item.billingHourlyRate, `scopeItems[${index}].billingHourlyRate`);
    return {
      id: optionalText(item.id, `scopeItems[${index}].id`, 100) || `SCOPE-${index + 1}`,
      name: optionalText(item.name, `scopeItems[${index}].name`, 300),
      description: optionalText(item.description, `scopeItems[${index}].description`, 2000),
      plannedHours,
      billingHourlyRate,
      contractValue: decimalFromScaled((scaledSignedDecimal(plannedHours) * scaledSignedDecimal(billingHourlyRate) + 500_000n) / 1_000_000n),
      unit: optionalText(item.unit, `scopeItems[${index}].unit`, 40) || "Hours",
      apuPlanVersion: optionalId(item.apuPlanVersion, `scopeItems[${index}].apuPlanVersion`),
      budgetSnapshotLineId: optionalText(item.budgetSnapshotLineId, `scopeItems[${index}].budgetSnapshotLineId`, 100),
      projectCostNodeId: optionalText(item.projectCostNodeId, `scopeItems[${index}].projectCostNodeId`, 100),
      scheduleItemPlacementId: optionalId(item.scheduleItemPlacementId, `scopeItems[${index}].scheduleItemPlacementId`),
      assumptions: optionalText(item.assumptions, `scopeItems[${index}].assumptions`, 2000),
      exclusions: optionalText(item.exclusions, `scopeItems[${index}].exclusions`, 2000),
    };
  });
  const normalizedAssignments = assignments.map((rawAssignment: any, index: number) => {
    const assignment = rawAssignment && typeof rawAssignment === "object" ? rawAssignment : {};
    const plannedHours = exact(assignment.plannedHours, `assignments[${index}].plannedHours`);
    const internalHourlyRate = exact(assignment.internalHourlyRate, `assignments[${index}].internalHourlyRate`);
    return {
      id: optionalText(assignment.id, `assignments[${index}].id`, 100) || `ASSIGN-${index + 1}`,
      userId: optionalId(assignment.userId, `assignments[${index}].userId`),
      personName: optionalText(assignment.personName, `assignments[${index}].personName`, 200),
      role: optionalText(assignment.role, `assignments[${index}].role`, 100),
      employmentType: optionalText(assignment.employmentType, `assignments[${index}].employmentType`, 50) || "employee",
      scopeItemId: optionalText(assignment.scopeItemId, `assignments[${index}].scopeItemId`, 100),
      plannedHours,
      internalHourlyRate,
      plannedLaborCost: decimalFromScaled((scaledSignedDecimal(plannedHours) * scaledSignedDecimal(internalHourlyRate) + 500_000n) / 1_000_000n),
    };
  });
  return {
    identity: {
      jobName: optionalText(identity.jobName, "identity.jobName", 300),
      jobCode: optionalText(identity.jobCode, "identity.jobCode", 60),
      clientName: optionalText(identity.clientName, "identity.clientName", 200),
      clientCompany: optionalText(identity.clientCompany, "identity.clientCompany", 200),
      location: optionalText(identity.location, "identity.location", 500),
      currency: identity.currency ? contractCurrency(identity.currency) : "USD",
      primaryContact: optionalText(identity.primaryContact, "identity.primaryContact", 200),
      startDate: optionalText(identity.startDate, "identity.startDate", 20),
      targetCompletionDate: optionalText(identity.targetCompletionDate, "identity.targetCompletionDate", 20),
    },
    scopeItems: normalizedItems,
    commercial: {
      quotationNumber: optionalText(commercial.quotationNumber, "commercial.quotationNumber", 100),
      contractNumber: optionalText(commercial.contractNumber, "commercial.contractNumber", 100),
      counterpartyName: optionalText(commercial.counterpartyName, "commercial.counterpartyName", 200),
      perspective: ["upstream", "downstream"].includes(String(commercial.perspective)) ? String(commercial.perspective) : "downstream",
      contractType: ["owner_prime", "subcontract", "purchase_order", "consultant_agreement", "other_commitment"].includes(String(commercial.contractType)) ? String(commercial.contractType) : "subcontract",
      budgetSnapshotId: optionalText(commercial.budgetSnapshotId, "commercial.budgetSnapshotId", 100),
      paymentTerms: optionalText(commercial.paymentTerms, "commercial.paymentTerms", 1000),
      effectiveDate: optionalText(commercial.effectiveDate, "commercial.effectiveDate", 20),
      completionDate: optionalText(commercial.completionDate, "commercial.completionDate", 20),
    },
    delivery: {
      workflowTemplate: optionalText(delivery.workflowTemplate, "delivery.workflowTemplate", 100) || "bim-submittal",
      submittalStrategy: optionalText(delivery.submittalStrategy, "delivery.submittalStrategy", 2000),
      milestoneSummary: optionalText(delivery.milestoneSummary, "delivery.milestoneSummary", 2000),
    },
    team: { projectLeaderUserId: optionalId(team.projectLeaderUserId, "team.projectLeaderUserId"), assignments: normalizedAssignments },
    review: {
      sourceConfirmed: bool(review.sourceConfirmed), scopeConfirmed: bool(review.scopeConfirmed), pricingConfirmed: bool(review.pricingConfirmed),
      contractConfirmed: bool(review.contractConfirmed), deliveryConfirmed: bool(review.deliveryConfirmed), teamConfirmed: bool(review.teamConfirmed),
    },
  };
}

const ratio = (checks: boolean[]) => checks.length ? checks.filter(Boolean).length / checks.length : 0;
export function jobIntakeCompletion(data: JobIntakeData, documents: Array<{ category: string; removedAt?: unknown }>) {
  const activeDocuments = documents.filter((document) => !document.removedAt);
  const hasCommercialSource = activeDocuments.some((document) => ["quotation", "contract", "proposal"].includes(document.category));
  const hasQuantitySource = activeDocuments.some((document) => ["takeoff", "estimate"].includes(document.category));
  const scopeReady = data.scopeItems.length > 0 && data.scopeItems.every((item) => item.name && positive(item.plannedHours));
  const pricingReady = data.scopeItems.length > 0 && data.scopeItems.every((item) => positive(item.billingHourlyRate) && item.apuPlanVersion != null);
  const contractItemsReady = data.scopeItems.length > 0 && data.scopeItems.every((item) => item.budgetSnapshotLineId && item.projectCostNodeId);
  const plannedHours = data.scopeItems.reduce((sum, item) => sum + scaledSignedDecimal(item.plannedHours), 0n);
  const assignedHours = data.team.assignments.reduce((sum: bigint, assignment: any) => sum + scaledSignedDecimal(assignment.plannedHours), 0n);
  const teamRatesReady = data.team.assignments.length > 0 && data.team.assignments.every((assignment: any) => (assignment.userId != null || assignment.personName) && assignment.role && positive(assignment.plannedHours) && positive(assignment.internalHourlyRate));
  const stageChecks: Record<JobIntakeStage, boolean[]> = {
    documents: [hasCommercialSource, hasQuantitySource],
    identity: [!!data.identity.jobName, !!data.identity.jobCode, !!data.identity.clientName, !!data.identity.currency],
    scope: [data.scopeItems.length > 0, scopeReady, data.review.scopeConfirmed],
    pricing: [pricingReady, data.review.pricingConfirmed],
    contract: [!!data.commercial.contractNumber, !!data.commercial.counterpartyName, !!data.commercial.budgetSnapshotId, contractItemsReady, data.review.contractConfirmed],
    delivery: [!!data.delivery.workflowTemplate, !!data.delivery.submittalStrategy, data.review.deliveryConfirmed],
    team: [data.team.projectLeaderUserId != null, teamRatesReady, assignedHours >= plannedHours && plannedHours > 0n, data.review.teamConfirmed],
    review: [data.review.sourceConfirmed, data.review.scopeConfirmed, data.review.pricingConfirmed, data.review.contractConfirmed, data.review.deliveryConfirmed, data.review.teamConfirmed],
  };
  const weights: Record<JobIntakeStage, number> = { documents: 10, identity: 10, scope: 20, pricing: 20, contract: 15, delivery: 10, team: 10, review: 5 };
  const stages = JOB_INTAKE_STAGES.map((key) => {
    const progress = Math.round(ratio(stageChecks[key]) * 100);
    return { key, weight: weights[key], progress, status: progress === 100 ? "complete" : progress === 0 ? "not_started" : "in_progress" };
  });
  const percent = Math.round(stages.reduce((sum, stage) => sum + stage.weight * stage.progress / 100, 0));
  const missing = [
    !hasCommercialSource && "Upload a quotation, proposal, or contract.", !hasQuantitySource && "Upload a takeoff or estimate.",
    !data.identity.jobName && "Enter the job name.", !data.identity.jobCode && "Enter the job code.", !data.identity.clientName && "Enter the client.",
    !scopeReady && "Add scope items with planned hours.", !pricingReady && "Select an APU and billing hourly rate for every scope item.",
    !contractItemsReady && "Map every scope item to an approved budget line.", !data.commercial.contractNumber && "Enter the negotiated contract number.",
    !data.commercial.counterpartyName && "Enter the contracting counterparty.", !data.commercial.budgetSnapshotId && "Select the approved budget snapshot.",
    !data.delivery.submittalStrategy && "Describe the Submittal delivery strategy.", data.team.projectLeaderUserId == null && "Assign a project leader.",
    !teamRatesReady && "Assign planned hours and internal hourly costs.", assignedHours < plannedHours && "Assign all planned scope hours to the team.",
    !Object.values(data.review).every(Boolean) && "Complete the final confirmations.",
  ].filter(Boolean) as string[];
  const totals = {
    plannedHours: decimalFromScaled(plannedHours), assignedHours: decimalFromScaled(assignedHours), unassignedHours: decimalFromScaled(plannedHours > assignedHours ? plannedHours - assignedHours : 0n),
    contractValue: decimalFromScaled(data.scopeItems.reduce((sum, item) => sum + scaledSignedDecimal(item.contractValue), 0n)),
    plannedLaborCost: decimalFromScaled(data.team.assignments.reduce((sum: bigint, item: any) => sum + scaledSignedDecimal(item.plannedLaborCost), 0n)),
  };
  return { percent, stages, missing, ready: percent === 100 && missing.length === 0, totals, fingerprint: crypto.createHash("sha256").update(JSON.stringify({ data, documents: activeDocuments.map((d) => d.category), percent, totals })).digest("hex") };
}
