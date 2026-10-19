export type ContractItemRateSource = {
  kind: "manual_contract_rate" | "saved_apu_rate";
  sourceId: string;
  sourceLabel: string;
  unitRate: string;
  unit: string;
  currency: string;
  apuPlanVersion: number | null;
  apuFingerprint?: string | null;
};

export function contractItemRateExplanation(source: any, quantity: unknown, spanish = false): string | null {
  if (!source || source.kind !== "saved_apu_rate") return null;
  const version = Number(source.apuPlanVersion);
  const prefix = Number.isSafeInteger(version) && version > 0 ? `APU v${version}` : "APU";
  const divisor = Number(quantity);
  if (source.rateCalculation === "plan_total_divided_by_contract_quantity" && source.planSellingPrice && Number.isFinite(divisor) && divisor > 0) {
    return spanish
      ? `${prefix}: total del plan ${source.planSellingPrice} ÷ cantidad ${String(quantity ?? "")} = tarifa unitaria ${source.unitRate}.`
      : `${prefix}: plan total ${source.planSellingPrice} ÷ quantity ${String(quantity ?? "")} = unit rate ${source.unitRate}.`;
  }
  if (source.rateCalculation === "plan_total_divided_by_contract_quantity") return null;
  return spanish
    ? `${prefix}: tarifa unitaria publicada ${source.unitRate}.`
    : `${prefix}: published unit rate ${source.unitRate}.`;
}

export function manualContractRateSource(input: { unitRate: unknown; unit: unknown; currency: unknown; apuPlanVersion?: unknown }): ContractItemRateSource {
  const version = Number(input.apuPlanVersion);
  return {
    kind: "manual_contract_rate",
    sourceId: "job-intake-contract-item",
    sourceLabel: "Contract Item unit rate",
    unitRate: String(input.unitRate ?? "0"),
    unit: String(input.unit ?? "Hours"),
    currency: String(input.currency ?? ""),
    apuPlanVersion: Number.isSafeInteger(version) && version > 0 ? version : null,
  };
}

export function emptyFinancialContractItem(apu?: any) {
  return { displayName: "", quantity: "1.00", unit: "Hours", unitRate: "", apuPlanVersion: apu?.version ? String(apu.version) : "", workflowTemplate: "bim-submittal", industryTemplate: "bim-services" };
}

export function changeContractItemRate(item: any, nextRate: string, source: ContractItemRateSource, changedAt = new Date().toISOString()) {
  const event = {
    changedAt,
    before: { unitRate: String(item.billingHourlyRate ?? "0"), apuPlanVersion: item.apuPlanVersion ?? null, sourceId: item.rateSource?.sourceId ?? null },
    after: { unitRate: nextRate, apuPlanVersion: source.apuPlanVersion, sourceId: source.sourceId },
  };
  return { ...item, billingHourlyRate: nextRate, apuPlanVersion: source.apuPlanVersion, rateSource: { ...source, unitRate: nextRate }, rateHistory: [...(Array.isArray(item.rateHistory) ? item.rateHistory : []), event].slice(-50) };
}
