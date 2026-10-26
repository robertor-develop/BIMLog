import { scaledSignedDecimal } from "./financial-budget-contract";

export type PricedAssignmentIdentity = {
  userId: number;
  role: string;
  plannedHours: string | number;
  demandId: string;
};

export function isExactPricedAssignmentReplay(stored: PricedAssignmentIdentity, requested: PricedAssignmentIdentity) {
  return stored.userId === requested.userId
    && stored.role === requested.role
    && stored.demandId === requested.demandId
    && scaledSignedDecimal(String(stored.plannedHours)) === scaledSignedDecimal(String(requested.plannedHours));
}

export function pricedStaffingArithmetic(input: { baselineHours: number; plannedHours: number; recordedHours: number; internalHourlyRate: number }) {
  if (![input.baselineHours,input.plannedHours,input.recordedHours,input.internalHourlyRate].every(Number.isFinite)
    || input.baselineHours < 0 || input.plannedHours <= 0 || input.recordedHours < 0 || input.internalHourlyRate < 0
    || input.plannedHours > input.baselineHours || input.recordedHours > input.plannedHours) throw new Error("PRICED_STAFFING_ARITHMETIC_INVALID");
  return {
    assignedHours: input.plannedHours,
    actualHours: input.recordedHours,
    remainingHours: input.baselineHours - input.plannedHours,
    plannedInternalCost: input.plannedHours * input.internalHourlyRate,
    actualInternalCost: input.recordedHours * input.internalHourlyRate,
  };
}
