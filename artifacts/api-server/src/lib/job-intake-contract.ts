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
export type JobIntakeCapabilities = {
  package: boolean;
  budget: boolean;
  contracts: boolean;
  costValuePlanner: boolean;
  anyCommercial: boolean;
  fullCommercialActivation: boolean;
};

export const FULL_JOB_INTAKE_CAPABILITIES: JobIntakeCapabilities = {
  package: true,
  budget: true,
  contracts: true,
  costValuePlanner: true,
  anyCommercial: true,
  fullCommercialActivation: true,
};

export function jobIntakeCoreFingerprint(data: JobIntakeData) {
  return crypto.createHash("sha256").update(JSON.stringify({
    identity: data.identity,
    scopeItems: data.scopeItems.map(({ billingHourlyRate: _billingHourlyRate, apuPlanVersion: _apuPlanVersion, budgetSnapshotLineId: _budgetSnapshotLineId, projectCostNodeId: _projectCostNodeId, contractValue: _contractValue, ...item }) => item),
    delivery: data.delivery,
    team: {
      projectLeaderUserId: data.team.projectLeaderUserId,
      assignments: data.team.assignments.map((entry: (typeof data.team.assignments)[number]) => {
        const { internalHourlyRate: _internalHourlyRate, plannedLaborCost: _plannedLaborCost, ...assignment } = entry;
        return assignment;
      }),
    },
  })).digest("hex");
}

export function jobIntakeCompletion(data: JobIntakeData, documents: Array<{ category: string; removedAt?: unknown }>, capabilities: JobIntakeCapabilities = FULL_JOB_INTAKE_CAPABILITIES) {
  const activeDocuments = documents.filter((document) => !document.removedAt);
  const hasCommercialSource = activeDocuments.some((document) => ["quotation", "contract", "proposal"].includes(document.category));
  const hasQuantitySource = activeDocuments.some((document) => ["takeoff", "estimate"].includes(document.category));
  const scopeReady = data.scopeItems.length > 0 && data.scopeItems.every((item) => item.name && positive(item.plannedHours));
  const pricingReady = data.scopeItems.length > 0 && data.scopeItems.every((item) => positive(item.billingHourlyRate) && item.apuPlanVersion != null);
  const contractItemsReady = data.scopeItems.length > 0 && data.scopeItems.every((item) => item.budgetSnapshotLineId && item.projectCostNodeId);
  const plannedHours = data.scopeItems.reduce((sum, item) => sum + scaledSignedDecimal(item.plannedHours), 0n);
  const assignedHours = data.team.assignments.reduce((sum: bigint, assignment: any) => sum + scaledSignedDecimal(assignment.plannedHours), 0n);
  const teamReady = data.team.assignments.length > 0 && data.team.assignments.every((assignment: any) => (assignment.userId != null || assignment.personName) && assignment.role && assignment.scopeItemId && data.scopeItems.some((item) => item.id === assignment.scopeItemId) && positive(assignment.plannedHours));
  const teamRatesReady = teamReady && data.team.assignments.every((assignment: any) => positive(assignment.internalHourlyRate));
  const contractTermsReady = !!data.commercial.contractNumber && !!data.commercial.counterpartyName;
  const budgetReady = !!data.commercial.budgetSnapshotId && contractItemsReady;
  const stageChecks: Record<JobIntakeStage, boolean[]> = {
    documents: [hasCommercialSource, hasQuantitySource],
    identity: [!!data.identity.jobName, !!data.identity.jobCode, !!data.identity.clientName, !!data.identity.currency],
    scope: [data.scopeItems.length > 0, scopeReady, data.review.scopeConfirmed],
    pricing: capabilities.costValuePlanner ? [pricingReady, data.review.pricingConfirmed] : [],
    contract: [
      ...(capabilities.contracts ? [contractTermsReady, data.review.contractConfirmed] : []),
      ...(capabilities.budget ? [budgetReady] : []),
    ],
    delivery: [!!data.delivery.workflowTemplate, !!data.delivery.submittalStrategy, data.review.deliveryConfirmed],
    team: [data.team.projectLeaderUserId != null, teamReady, ...(capabilities.budget ? [teamRatesReady] : []), assignedHours >= plannedHours && plannedHours > 0n, data.review.teamConfirmed],
    review: [data.review.sourceConfirmed, data.review.scopeConfirmed, ...(capabilities.costValuePlanner ? [data.review.pricingConfirmed] : []), ...(capabilities.contracts ? [data.review.contractConfirmed] : []), data.review.deliveryConfirmed, data.review.teamConfirmed],
  };
  const baseWeights: Record<JobIntakeStage, number> = { documents: 10, identity: 10, scope: 20, pricing: 20, contract: 15, delivery: 10, team: 10, review: 5 };
  const requiredWeight = JOB_INTAKE_STAGES.reduce((sum, key) => sum + (stageChecks[key].length ? baseWeights[key] : 0), 0);
  const stages = JOB_INTAKE_STAGES.map((key) => {
    const required = stageChecks[key].length > 0;
    const progress = Math.round(ratio(stageChecks[key]) * 100);
    return { key, required, weight: required ? baseWeights[key] : 0, progress: required ? progress : 100, status: required ? progress === 100 ? "complete" : progress === 0 ? "not_started" : "in_progress" : "optional" };
  });
  const percent = requiredWeight ? Math.round(stages.reduce((sum, stage) => sum + stage.weight * stage.progress / 100, 0) * 100 / requiredWeight) : 100;
  const missingItems = [
    !hasCommercialSource && { code: "source_commercial", en: "Upload a quotation, proposal, or contract.", es: "Cargue una cotización, propuesta o contrato." },
    !hasQuantitySource && { code: "source_quantity", en: "Upload a takeoff or estimate.", es: "Cargue un cómputo de cantidades o estimado." },
    !data.identity.jobName && { code: "job_name", en: "Enter the job name.", es: "Ingrese el nombre del trabajo." },
    !data.identity.jobCode && { code: "job_code", en: "Enter the job code.", es: "Ingrese el código del trabajo." },
    !data.identity.clientName && { code: "client", en: "Enter the client.", es: "Ingrese el cliente." },
    !scopeReady && { code: "scope", en: "Add scope items with planned hours.", es: "Agregue partidas de alcance con horas planificadas." },
    capabilities.costValuePlanner && !pricingReady && { code: "pricing", en: "Select an APU and billing hourly rate for every scope item.", es: "Seleccione un APU y una tarifa facturable para cada partida." },
    capabilities.budget && !contractItemsReady && { code: "budget_mapping", en: "Map every scope item to an approved budget line.", es: "Vincule cada partida con una línea de presupuesto aprobada." },
    capabilities.contracts && !data.commercial.contractNumber && { code: "contract_number", en: "Enter the negotiated contract number.", es: "Ingrese el número de contrato negociado." },
    capabilities.contracts && !data.commercial.counterpartyName && { code: "counterparty", en: "Enter the contracting counterparty.", es: "Ingrese la contraparte contractual." },
    capabilities.budget && !data.commercial.budgetSnapshotId && { code: "budget_snapshot", en: "Select the approved budget snapshot.", es: "Seleccione el presupuesto aprobado." },
    !data.delivery.submittalStrategy && { code: "delivery", en: "Describe the Submittal delivery strategy.", es: "Describa la estrategia de entrega de submittals." },
    data.team.projectLeaderUserId == null && { code: "leader", en: "Assign a project leader.", es: "Asigne un líder del proyecto." },
    !teamReady && { code: "team", en: "Assign every team member to a scope item with planned hours.", es: "Asigne cada miembro a una partida con horas planificadas." },
    capabilities.budget && !teamRatesReady && { code: "internal_rates", en: "Enter internal hourly costs for the resource plan.", es: "Ingrese los costos horarios internos del plan de recursos." },
    assignedHours < plannedHours && { code: "hours", en: "Assign all planned scope hours to the team.", es: "Asigne al equipo todas las horas planificadas." },
    !(data.review.sourceConfirmed && data.review.scopeConfirmed && data.review.deliveryConfirmed && data.review.teamConfirmed && (!capabilities.costValuePlanner || data.review.pricingConfirmed) && (!capabilities.contracts || data.review.contractConfirmed)) && { code: "confirmations", en: "Complete the required final confirmations.", es: "Complete las confirmaciones finales requeridas." },
  ].filter(Boolean) as Array<{ code: string; en: string; es: string }>;
  const missing = missingItems.map((item) => item.en);
  const totals = {
    plannedHours: decimalFromScaled(plannedHours), assignedHours: decimalFromScaled(assignedHours), unassignedHours: decimalFromScaled(plannedHours > assignedHours ? plannedHours - assignedHours : 0n),
    contractValue: decimalFromScaled(data.scopeItems.reduce((sum, item) => sum + scaledSignedDecimal(item.contractValue), 0n)),
    plannedLaborCost: decimalFromScaled(data.team.assignments.reduce((sum: bigint, item: any) => sum + scaledSignedDecimal(item.plannedLaborCost), 0n)),
  };
  const overlayReadiness = {
    costValuePlanner: !capabilities.costValuePlanner ? "not_entitled" : pricingReady ? "ready" : "requires_input",
    budget: !capabilities.budget ? "not_entitled" : budgetReady ? "ready" : "requires_input",
    contracts: !capabilities.contracts ? "not_entitled" : contractTermsReady ? "ready" : "requires_input",
    automaticCommercialActivation: !capabilities.fullCommercialActivation ? "not_entitled" : pricingReady && budgetReady && contractTermsReady ? "ready" : "requires_input",
  };
  return { percent, stages, missing, missingItems, ready: percent === 100 && missing.length === 0, totals, capabilities, overlayReadiness, coreFingerprint: jobIntakeCoreFingerprint(data), fingerprint: crypto.createHash("sha256").update(JSON.stringify({ data, documents: activeDocuments.map((d) => d.category), percent, totals, capabilities })).digest("hex") };
}
