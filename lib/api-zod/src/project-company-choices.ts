/** Read-only company labels; these never establish a company ID, contact or permission. */
export function conventionCompanyCodes(convention: { companyCode?: unknown; fields?: unknown } | null | undefined): string[] {
  const fields = Array.isArray(convention?.fields) ? convention.fields : [];
  const originator = fields.find(field => field && typeof field === "object" &&
    typeof field.label === "string" && field.label.trim().toLowerCase() === "originator");
  // The naming dictionary is the authority used by Name Generator. Scalar-only
  // legacy conventions remain supported, but stale scalars cannot replace it.
  const values = originator && Array.isArray(originator.allowedValues)
    ? originator.allowedValues
    : typeof convention?.companyCode === "string" ? convention.companyCode.split(",") : [];
  return uniqueProjectCompanyLabels(values);
}

export function uniqueProjectCompanyLabels(values: unknown[]): string[] {
  const labels = new Map<string, string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = value.trim().replace(/\s+/g, " ");
    if (label && !labels.has(label.toLowerCase())) labels.set(label.toLowerCase(), label);
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}
