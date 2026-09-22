export type CompanyCatalogKind = "client" | "discipline" | "service" | "phase";

export type CompanyCatalogUsage = Readonly<{
  intakeCount: number;
  taskCount: number;
  workPackageCount: number;
  totalCount: number;
}>;

export function classificationColumn(kind: CompanyCatalogKind): string | null {
  if (kind === "discipline") return "discipline_id";
  if (kind === "service") return "service_id";
  if (kind === "phase") return "phase_id";
  return null;
}

export function normalizeCompanyCatalogUsage(row: Record<string, unknown>): CompanyCatalogUsage {
  const count = (key: string) => {
    const value = Number(row[key] ?? 0);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  const intakeCount = count("intakeCount");
  const taskCount = count("taskCount");
  const workPackageCount = count("workPackageCount");
  return Object.freeze({
    intakeCount,
    taskCount,
    workPackageCount,
    totalCount: intakeCount + taskCount + workPackageCount,
  });
}

