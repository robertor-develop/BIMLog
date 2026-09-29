type PriorityOption = { value: string; label: string; labelEs?: string };
// Preserve the first configured value/label, matching ConfigProvider.getLabel.
// Deduplicate stable values, never translated labels or distinct legacy values.
export function uniqueRfiPriorities<T extends PriorityOption>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter(option => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value); return true;
  });
}
export function withCurrentPriority(options: { value: string; label: string }[], current: string) {
  const unique = uniqueRfiPriorities(options);
  return current && !unique.some(o => o.value === current) ? [...unique, { value: current, label: current }] : unique;
}
