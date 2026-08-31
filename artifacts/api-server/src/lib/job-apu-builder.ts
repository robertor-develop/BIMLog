import { FinancialControlError } from "./financial-control-contract";

export const JOB_APU_METHODS = [
  "hours_hourly_rate",
  "quantity_unit_cost",
  "fixed_amount",
] as const;
export const JOB_APU_TEMPLATES = [
  "drafting",
  "bim_coordination",
  "custom",
] as const;
export const JOB_APU_DEFAULTS = Object.freeze({
  drafting: Object.freeze({
    method: "hours_hourly_rate",
    hourlyRate: "35.47",
    currency: "USD",
    provenance: "portfolio_default",
  }),
  bim_coordination: Object.freeze({
    method: "hours_hourly_rate",
    hourlyRate: "37.99",
    currency: "USD",
    provenance: "portfolio_default",
  }),
});
const decimal = (value: unknown, field: string) => {
  const text = String(value ?? "0").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text))
    throw new FinancialControlError(
      400,
      "JOB_APU_DECIMAL_INVALID",
      `${field} must be a non-negative decimal.`,
    );
  return text;
};
const optionalText = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
};

export function normalizeJobApuDrafts(
  value: unknown,
  contractIds: Set<string>,
) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > 100)
    throw new FinancialControlError(
      400,
      "JOB_APU_LIMIT",
      "An Intake accepts up to 100 APU drafts.",
    );
  const ids = new Set<string>();
  return rows.map((raw: any, index) => {
    const item = raw && typeof raw === "object" ? raw : {};
    const id = optionalText(item.id, 100);
    if (!id)
      throw new FinancialControlError(
        400,
        "JOB_APU_ID_REQUIRED",
        "Every APU draft requires a stable ID.",
      );
    if (ids.has(id))
      throw new FinancialControlError(
        400,
        "JOB_APU_ID_DUPLICATE",
        "APU draft IDs must be unique.",
      );
    ids.add(id);
    const contractId = optionalText(item.contractId, 100);
    if (!contractId || !contractIds.has(contractId))
      throw new FinancialControlError(
        400,
        "JOB_APU_CONTRACT_INVALID",
        "Every APU draft must belong to an agreement in this Intake.",
      );
    const method = JOB_APU_METHODS.includes(item.method)
      ? item.method
      : "hours_hourly_rate";
    const templateKey = JOB_APU_TEMPLATES.includes(item.templateKey)
      ? item.templateKey
      : "custom";
    const canonicalVersionId =
      Number.isSafeInteger(Number(item.canonicalVersionId)) &&
      Number(item.canonicalVersionId) > 0
        ? Number(item.canonicalVersionId)
        : null;
    return {
      id,
      contractId,
      title: optionalText(item.title, 200) || `APU ${index + 1}`,
      templateKey,
      method,
      hours: decimal(item.hours, `apuDrafts[${index}].hours`),
      hourlyRate: decimal(item.hourlyRate, `apuDrafts[${index}].hourlyRate`),
      quantity: decimal(item.quantity, `apuDrafts[${index}].quantity`),
      unitCost: decimal(item.unitCost, `apuDrafts[${index}].unitCost`),
      fixedAmount: decimal(item.fixedAmount, `apuDrafts[${index}].fixedAmount`),
      currency: optionalText(item.currency, 3)?.toUpperCase() || "USD",
      rateProvenance: optionalText(item.rateProvenance, 100),
      canonicalVersionId,
      authorityState: canonicalVersionId ? "approved_linked" : "draft",
    };
  });
}
export function calculateJobApuDraft(item: any) {
  const amount =
    item.method === "fixed_amount"
      ? Number(item.fixedAmount)
      : item.method === "quantity_unit_cost"
        ? Number(item.quantity) * Number(item.unitCost)
        : Number(item.hours) * Number(item.hourlyRate);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}
