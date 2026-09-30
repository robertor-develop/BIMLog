export type ContractItemApuConnection = {
  billingHourlyRate?: string;
  unit?: string;
  rateSource?: Record<string, unknown> | null;
  apuPlanVersion?: number | null;
  [key: string]: unknown;
};

export function connectContractItemsToApu<T extends ContractItemApuConnection>(
  items: T[],
  apu: { version: number; name?: string; currency?: string; fingerprint?: string | null },
): T[] {
  return items.map((item) => ({
    ...item,
    apuPlanVersion: apu.version,
    rateSource: item.billingHourlyRate ? {
      kind: "saved_apu_rate",
      sourceId: `apu-plan-v${apu.version}`,
      sourceLabel: apu.name || `APU v${apu.version}`,
      unitRate: item.billingHourlyRate,
      unit: item.unit || "Hours",
      currency: apu.currency || "",
      apuPlanVersion: apu.version,
      apuFingerprint: apu.fingerprint || null,
    } : null,
  }));
}
