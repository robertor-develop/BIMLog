export const SHOP_DRAWING = "SHOP_DRAWING" as const;

const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export function isBimtechDeliveryCompany(labels: unknown[]) {
  return labels.some(label => ["bimtech", "bimtechcorp", "bimtechcorporation"].includes(normalized(label)));
}

export function applyShopDrawingPreset<T extends Record<string, any>>(items: T[], eligible: boolean) {
  if (!eligible) return items;
  let changed = false;
  const result = items.map(item => item.deliverableType && item.deliverableType !== "GENERAL" ? item : (changed = true, {
    ...item, deliverableType: SHOP_DRAWING, workflowTemplate: item.workflowTemplate || "bim-submittal",
  }));
  return changed ? result : items;
}

export function deriveShopDrawingPackages(input: { scopeItemId: string; existing?: any[]; levels: any[]; disciplines: any[] }) {
  const existing = input.existing ?? [];
  const seen = new Set(existing.map(row => `${row.location?.levelId ?? ""}:${row.classification?.disciplineId ?? ""}:SHOP_DRAWING`));
  const created: any[] = [];
  for (const level of input.levels) for (const discipline of input.disciplines) {
    const key = `${level.id}:${discipline.id}:SHOP_DRAWING`;
    if (seen.has(key)) continue;
    seen.add(key);
    created.push({ id:`WP-${input.scopeItemId}-${level.id}-${discipline.id}`, packageCode:`SD-${level.code}-${discipline.code}`,
      title:`${level.name} · ${discipline.name} shop drawings`, dimensionType:"floor", dimensionValue:level.name,
      location:{buildingId:level.buildingId,levelId:level.id}, packageType:"shop_drawing",
      classification:{disciplineId:discipline.id,disciplineCode:discipline.code,disciplineName:discipline.name}, tasks:[] });
  }
  return [...existing, ...created];
}

export function governedDeliveryState(runtime: any) {
  const phases = runtime?.definition?.phases ?? [];
  const index = Math.max(0, Number(runtime?.phaseIndex ?? 1) - 1);
  const phase = phases[index] ?? null;
  const steps = (runtime?.steps ?? []).filter((step: any) => step.phaseId === phase?.id);
  return { state: runtime?.status ?? "unavailable", phaseId: phase?.id ?? null, phaseName: phase?.name ?? null,
    completed: steps.filter((step:any) => step.status === "complete").length, total: steps.length,
    nextAction: runtime?.status === "complete" ? "complete" : steps.some((step:any) => step.status !== "complete") ? "prepare" : phase?.qcRequired ? "review" : phase?.approvalRequired ? "approve" : "advance" };
}
