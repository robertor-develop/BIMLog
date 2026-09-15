export type IntakeApuVersion = { version: number; name?: string; sellingPrice: string };

export function soleCompatibleApuVersion(versions: IntakeApuVersion[]) {
  const valid = versions.filter((item) =>
    Number.isSafeInteger(Number(item.version)) && Number(item.version) > 0 &&
    /^\d+(?:\.\d{1,6})?$/.test(String(item.sellingPrice ?? "").trim()),
  );
  return valid.length === 1 ? valid[0] : null;
}

export function applySoleApuToUnboundItems(items: any[], versions: IntakeApuVersion[]) {
  const sole = soleCompatibleApuVersion(versions);
  if (!sole) return items;
  return items.map((item) => item.apuPlanVersion == null
    ? { ...item, apuPlanVersion: sole.version, billingHourlyRate: sole.sellingPrice }
    : item);
}
