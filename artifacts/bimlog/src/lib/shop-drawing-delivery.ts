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
