import { FinancialControlError } from "./financial-control-contract";

const optionalText = (value: unknown, field: string, max: number) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) throw new FinancialControlError(400, "JOB_WORK_PACKAGE_TEXT_TOO_LONG", `${field} is too long.`);
  return text || null;
};

export function normalizeJobWorkPackages(value: unknown, apuContractIds: Map<string, string>) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > 500) throw new FinancialControlError(400, "JOB_WORK_PACKAGE_LIMIT", "An Intake accepts up to 500 work packages.");
  const ids = new Set<string>();
  return rows.map((raw: any, index) => {
    const item = raw && typeof raw === "object" ? raw : {};
    const id = optionalText(item.id, `workPackages[${index}].id`, 100);
    if (!id) throw new FinancialControlError(400, "JOB_WORK_PACKAGE_ID_REQUIRED", "Every work package requires a stable ID.");
    if (ids.has(id)) throw new FinancialControlError(400, "JOB_WORK_PACKAGE_ID_DUPLICATE", "Work package IDs must be unique.");
    ids.add(id);
    const apuDraftId = optionalText(item.apuDraftId, `workPackages[${index}].apuDraftId`, 100);
    if (!apuDraftId || !apuContractIds.has(apuDraftId)) throw new FinancialControlError(400, "JOB_WORK_PACKAGE_APU_INVALID", "Every work package must belong to an APU in this Intake.");
    return {
      id,
      apuDraftId,
      contractId: apuContractIds.get(apuDraftId)!,
      title: optionalText(item.title, `workPackages[${index}].title`, 200),
      floor: optionalText(item.floor, `workPackages[${index}].floor`, 100),
      zone: optionalText(item.zone, `workPackages[${index}].zone`, 100),
      task: optionalText(item.task, `workPackages[${index}].task`, 300),
      deliverable: optionalText(item.deliverable, `workPackages[${index}].deliverable`, 300),
    };
  });
}

export function summarizeJobWorkPackages(rows: ReturnType<typeof normalizeJobWorkPackages>) {
  return {
    total: rows.length,
    floors: new Set(rows.map((row) => row.floor).filter(Boolean)).size,
    zones: new Set(rows.map((row) => row.zone).filter(Boolean)).size,
    tasks: rows.filter((row) => row.task).length,
    deliverables: rows.filter((row) => row.deliverable).length,
  };
}
