export type ContractItemApuConnection = {
  billingHourlyRate?: string;
  unit?: string;
  rateSource?: Record<string, unknown> | null;
  apuPlanVersion?: number | null;
  [key: string]: unknown;
};

export function connectContractItemsToApu<T extends ContractItemApuConnection>(
  items: T[],
  apu: { version: number; name?: string; sellingPrice?: string; currency?: string; fingerprint?: string | null },
): Array<T & ContractItemApuConnection> {
  return items.map((item) => ({
    ...item,
    apuPlanVersion: apu.version,
    ...(apu.sellingPrice ? { billingHourlyRate: apu.sellingPrice } : {}),
    rateSource: (apu.sellingPrice || item.billingHourlyRate) ? {
      kind: "saved_apu_rate",
      sourceId: `apu-plan-v${apu.version}`,
      sourceLabel: apu.name || `APU v${apu.version}`,
      unitRate: apu.sellingPrice || item.billingHourlyRate,
      unit: item.unit || "Hours",
      currency: apu.currency || "",
      apuPlanVersion: apu.version,
      apuFingerprint: apu.fingerprint || null,
    } : null,
  }));
}
