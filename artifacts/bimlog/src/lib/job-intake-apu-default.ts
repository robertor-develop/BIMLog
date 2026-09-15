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

export function contractApuCoverage(contracts: any[], items: any[]) {
  return contracts.map((contract) => {
    const owned = items.filter((item) => item.contractId === contract.id);
    const bound = owned.filter((item) => item.apuPlanVersion != null);
    const versions = [...new Set(bound.map((item) => Number(item.apuPlanVersion)))].sort((a, b) => a - b);
    return {
      contractId: contract.id,
      label: contract.title || contract.contractNumber || contract.id,
      itemCount: owned.length,
      boundCount: bound.length,
      versions,
      status: owned.length === 0 ? "empty" : bound.length === owned.length ? "complete" : "incomplete",
    };
  });
}
