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
