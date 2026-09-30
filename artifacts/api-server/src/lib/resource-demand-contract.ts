import { FinancialControlError } from "./financial-control-contract";
import { decimalFromScaled, scaledSignedDecimal } from "./financial-budget-contract";

export type ResourceDemand = {
  id: string;
  role: string;
  scopeItemId: string;
  workPackageId: string;
  workPackageTaskId: string;
  locationLabel: string;
  resourceCount: number;
  plannedHours: string;
  plannedCostPerHour: string;
  plannedCost: string;
};

export function isNamedResourceAssignment(value: any) {
  return value?.userId != null || String(value?.personName ?? "").trim().length > 0;
}

export function resourceDemandFromPlan(value: any): ResourceDemand {
  if (isNamedResourceAssignment(value))
    throw new FinancialControlError(400, "RESOURCE_DEMAND_NAMED_PERSON", "A planning demand cannot contain a named person.");
  const resourceCount = Number(value?.resourceCount ?? 1);
  if (!Number.isSafeInteger(resourceCount) || resourceCount < 1 || resourceCount > 100)
    throw new FinancialControlError(400, "RESOURCE_DEMAND_COUNT_INVALID", "Resource quantity must be between 1 and 100.");
  const hours = scaledSignedDecimal(value?.plannedHours ?? "0");
  const rate = scaledSignedDecimal(value?.internalHourlyRate ?? value?.plannedCostPerHour ?? "0");
  const plannedCost = (hours * rate * BigInt(resourceCount) + 500_000n) / 1_000_000n;
  return {
    id: String(value?.id ?? ""), role: String(value?.role ?? "").trim(), scopeItemId: String(value?.scopeItemId ?? ""),
    workPackageId: String(value?.workPackageId ?? ""), workPackageTaskId: String(value?.workPackageTaskId ?? ""),
    locationLabel: String(value?.locationLabel ?? "").trim(), resourceCount,
    plannedHours: decimalFromScaled(hours), plannedCostPerHour: decimalFromScaled(rate), plannedCost: decimalFromScaled(plannedCost),
  };
}

export function splitResourcePlan(rows: any[]) {
  const namedAssignments = rows.filter(isNamedResourceAssignment);
  const demands = rows.filter((row) => !isNamedResourceAssignment(row)).map(resourceDemandFromPlan);
  return { demands, namedAssignments };
}

export function reconcileResourceDemand(input: { demands: ResourceDemand[]; workItems: any[]; assignments: any[]; timeEntries: any[] }) {
  return input.demands.map((demand) => {
    const workItemIds = new Set(input.workItems.filter((row) => String(row.stableScopeItemId) === demand.scopeItemId).map((row) => String(row.id)));
    const assignments = input.assignments.filter((row) => workItemIds.has(String(row.workItemId)));
    const assignmentIds = new Set(assignments.map((row) => String(row.id)));
    const assignedHours = assignments.reduce((sum, row) => sum + Number(row.plannedHours ?? 0), 0);
    const actualHours = input.timeEntries.filter((row) => assignmentIds.has(String(row.assignmentId))).reduce((sum, row) => sum + Number(row.hours ?? 0), 0);
    const baselineHours = Number(demand.plannedHours) * demand.resourceCount;
    return { demandId:demand.id, scopeItemId:demand.scopeItemId, role:demand.role, locationLabel:demand.locationLabel, baselineHours, assignedHours, actualHours, remainingHours:Math.max(0,baselineHours-assignedHours), state:assignedHours===0?"unassigned":assignedHours<baselineHours?"partially_assigned":"assigned" };
  });
}
