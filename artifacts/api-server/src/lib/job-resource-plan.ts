import { FinancialControlError } from "./financial-control-contract";

const decimal = (value: unknown, field: string) => {
  const text = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new FinancialControlError(400, "JOB_RESOURCE_DECIMAL_INVALID", `${field} must be a non-negative decimal.`);
  return text;
};
const text = (value: unknown, field: string, max: number) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > max) throw new FinancialControlError(400, "JOB_RESOURCE_TEXT_TOO_LONG", `${field} is too long.`);
  return normalized || null;
};
const amount = (hours: string, rate: string) => (Number(hours) * Number(rate)).toFixed(2);

export function normalizeJobResourcePlans(value: unknown, workPackageIds: Set<string>) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > 1000) throw new FinancialControlError(400, "JOB_RESOURCE_PLAN_LIMIT", "An Intake accepts up to 1,000 resource plans.");
  const ids = new Set<string>();
  return rows.map((raw: any, index) => {
    const item = raw && typeof raw === "object" ? raw : {};
    const id = text(item.id, `resourcePlans[${index}].id`, 100);
    if (!id) throw new FinancialControlError(400, "JOB_RESOURCE_PLAN_ID_REQUIRED", "Every resource plan requires a stable ID.");
    if (ids.has(id)) throw new FinancialControlError(400, "JOB_RESOURCE_PLAN_ID_DUPLICATE", "Resource plan IDs must be unique.");
    ids.add(id);
    const workPackageId = text(item.workPackageId, `resourcePlans[${index}].workPackageId`, 100);
    if (!workPackageId || !workPackageIds.has(workPackageId)) throw new FinancialControlError(400, "JOB_RESOURCE_WORK_PACKAGE_INVALID", "Every resource plan must belong to a work package in this Intake.");
    const plannedHours = decimal(item.plannedHours, `resourcePlans[${index}].plannedHours`);
    const internalHourlyRate = decimal(item.internalHourlyRate, `resourcePlans[${index}].internalHourlyRate`);
    const incentiveType = ["none", "fixed", "percent"].includes(String(item.incentiveType)) ? String(item.incentiveType) : "none";
    return { id, workPackageId, userId: Number.isSafeInteger(Number(item.userId)) && Number(item.userId) > 0 ? Number(item.userId) : null, personName: text(item.personName, `resourcePlans[${index}].personName`, 200), role: text(item.role, `resourcePlans[${index}].role`, 120), plannedHours, internalHourlyRate, plannedInternalCost: amount(plannedHours, internalHourlyRate), incentiveType, incentiveValue: decimal(item.incentiveValue, `resourcePlans[${index}].incentiveValue`), delegationStatus: item.delegationStatus === "redelegated" ? "redelegated" : "assigned", delegatedBy: text(item.delegatedBy, `resourcePlans[${index}].delegatedBy`, 200), notes: text(item.notes, `resourcePlans[${index}].notes`, 1000) };
  });
}

export function summarizeJobResourcePlans(rows: ReturnType<typeof normalizeJobResourcePlans>) {
  return { assignments: rows.length, plannedHours: rows.reduce((sum, row) => sum + Number(row.plannedHours), 0).toFixed(2), plannedInternalCost: rows.reduce((sum, row) => sum + Number(row.plannedInternalCost), 0).toFixed(2), redelegated: rows.filter((row) => row.delegationStatus === "redelegated").length };
}
