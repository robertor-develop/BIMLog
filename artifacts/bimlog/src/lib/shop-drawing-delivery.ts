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

export function shopDrawingEvidenceContinuity(input: { packages?: any[]; packageTasks?: any[]; deliverables?: any[]; connections?: any[] }) {
  const packageTasks = input.packageTasks ?? [], deliverables = input.deliverables ?? [], connections = input.connections ?? [];
  return (input.packages ?? []).filter(row => row.packageType === "shop_drawing").map(pkg => {
    const taskIds = packageTasks.filter(link => link.packageId === pkg.id).map(link => link.taskId);
    const packageConnections = connections.filter(link => (link.targetType === "work_package" && link.targetId === pkg.id) || (link.targetType === "task" && taskIds.includes(link.targetId)));
    const taskDeliverables = deliverables.filter(link => taskIds.includes(link.taskId));
    return { packageId:pkg.id, taskIds, submittals:taskDeliverables.filter(link => link.deliverableType === "submittal" || link.deliverableType === "shop_drawing").length,
      rfis:packageConnections.filter(link => link.entityType === "rfi").length, evidence:taskDeliverables.length + packageConnections.length };
  });
}

export function coordinatorShopDrawingOverview(input: { packages?: any[]; packageTasks?: any[]; tasks?: any[]; deliverables?: any[]; connections?: any[] }) {
  const continuity = new Map(shopDrawingEvidenceContinuity(input).map(row => [row.packageId,row]));
  return (input.packages ?? []).filter(row => row.packageType === "shop_drawing").map(pkg => {
    const taskIds = (input.packageTasks ?? []).filter(link => link.packageId === pkg.id).map(link => link.taskId);
    const tasks = (input.tasks ?? []).filter(task => taskIds.includes(task.id));
    const nextAction = pkg.status === "approved" ? "complete" : pkg.status === "returned" ? "revise" : pkg.status === "submitted" ? "review" : pkg.status === "internal_review" ? "finish review" : tasks.some(task => task.status !== "complete") ? "prepare" : "issue";
    return { packageId:pkg.id, code:pkg.packageCode, floor:String(pkg.description ?? "").replace(/^[^:]+:\s*/,"") || "—", discipline:pkg.disciplineName || pkg.disciplineCode || "—",
      state:pkg.status, progress:Number(pkg.progressPercent ?? 0), nextAction, unassigned:tasks.some(task => task.assigneeUserId == null), evidence:continuity.get(pkg.id)?.evidence ?? 0 };
  });
}
