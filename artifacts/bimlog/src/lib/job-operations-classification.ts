export type OperationsClassificationKind = "discipline" | "service" | "phase";

export type OperationsClassificationFilters = Record<
  OperationsClassificationKind,
  string
>;

export type ClassifiedOperationsRecord = Partial<
  Record<`${OperationsClassificationKind}Id`, string | null>
> &
  Partial<Record<`${OperationsClassificationKind}Code`, string | null>> &
  Partial<Record<`${OperationsClassificationKind}Name`, string | null>>;

export type OperationsClassificationOption = {
  id: string;
  code: string;
  name: string;
};

export const emptyOperationsClassificationFilters =
  (): OperationsClassificationFilters => ({
    discipline: "",
    service: "",
    phase: "",
  });

export function operationsClassificationOptions(
  records: ClassifiedOperationsRecord[],
  kind: OperationsClassificationKind,
): OperationsClassificationOption[] {
  const options = new Map<string, OperationsClassificationOption>();
  for (const record of records) {
    const id = String(record[`${kind}Id`] ?? "").trim();
    if (!id) continue;
    options.set(id, {
      id,
      code: String(record[`${kind}Code`] ?? "").trim(),
      name: String(record[`${kind}Name`] ?? "").trim(),
    });
  }
  return [...options.values()].sort((left, right) =>
    (left.name || left.code || left.id).localeCompare(
      right.name || right.code || right.id,
    ),
  );
}

export function matchesOperationsClassification(
  record: ClassifiedOperationsRecord,
  filters: OperationsClassificationFilters,
): boolean {
  return (["discipline", "service", "phase"] as const).every(
    (kind) =>
      !filters[kind] || String(record[`${kind}Id`] ?? "") === filters[kind],
  );
}
