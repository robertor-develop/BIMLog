export type ContractItemApuConnection = {
  quantity?: string;
  billingHourlyRate?: string;
  unit?: string;
  rateSource?: Record<string, unknown> | null;
  apuPlanVersion?: number | null;
  [key: string]: unknown;
};

export function connectContractItemsToApu<T extends ContractItemApuConnection>(
  items: T[],
  apu: { version: number; name?: string; sellingPrice?: string; unitRate?: string; currency?: string; fingerprint?: string | null },
): Array<T & ContractItemApuConnection> {
  return items.map((item) => {
    const quantity = exactPositiveDecimal(item.quantity);
    const sellingPrice = exactPositiveDecimal(apu.sellingPrice);
    const explicitRate = exactPositiveDecimal(apu.unitRate);
    const derivedRate = explicitRate ?? (sellingPrice && quantity ? divideSix(sellingPrice, quantity) : null);
    const unitRate = derivedRate ?? item.billingHourlyRate;
    return {
    ...item,
    apuPlanVersion: apu.version,
    ...(derivedRate ? { billingHourlyRate: derivedRate } : {}),
    rateSource: unitRate ? {
      kind: "saved_apu_rate",
      sourceId: `apu-plan-v${apu.version}`,
      sourceLabel: apu.name || `APU v${apu.version}`,
      unitRate,
      unit: item.unit || "Hours",
      currency: apu.currency || "",
      apuPlanVersion: apu.version,
      apuFingerprint: apu.fingerprint || null,
      ...(apu.sellingPrice ? { planSellingPrice: apu.sellingPrice } : {}),
      ...(explicitRate ? { rateCalculation: "published_unit_rate" } : derivedRate ? { rateCalculation: "plan_total_divided_by_contract_quantity" } : {}),
    } : null,
  }});
}

function exactPositiveDecimal(value: unknown): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const scaled = BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));
  return scaled > 0n ? scaled : null;
}

function divideSix(numerator: bigint, denominator: bigint): string {
  const scaled = (numerator * 1_000_000n + denominator / 2n) / denominator;
  const whole = scaled / 1_000_000n;
  const fraction = String(scaled % 1_000_000n).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}
