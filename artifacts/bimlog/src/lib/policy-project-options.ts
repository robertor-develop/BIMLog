export type PolicyProjectOption = { id: number; name: string; active: boolean; bindingRequired?: boolean; canConfigure: boolean };

/** Collapse repeated capability rows without widening the permission decision. */
export function policyProjectOptions(rows: PolicyProjectOption[]): PolicyProjectOption[] {
  const unique = new Map<number, PolicyProjectOption>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0) continue;
    const previous = unique.get(row.id);
    unique.set(row.id, previous ? {
      ...previous,
      active: previous.active && row.active,
      bindingRequired: previous.bindingRequired === true || row.bindingRequired === true,
      canConfigure: previous.canConfigure && row.canConfigure,
    } : { ...row });
  }
  return [...unique.values()];
}

export function initialPolicyProject(rows: PolicyProjectOption[]): number | null {
  return rows.find(row => row.active && !row.bindingRequired)?.id ?? null;
}
