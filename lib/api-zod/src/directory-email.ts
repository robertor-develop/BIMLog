/** Storage placeholders preserve legacy directory identity, but are never recipients. */
export function isDirectoryPlaceholderEmail(value: unknown): boolean {
  const email = String(value ?? "").trim().toLowerCase();
  return email.endsWith("@project-directory.local") || email === "contact@bimlog.io" || email === "imported@bimlog.io";
}

export function isDirectoryRecipientEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim()) && !isDirectoryPlaceholderEmail(value);
}

export function isCompanyOnlyEntry(entry: { role?: string | null; email?: string | null }) {
  return entry.role === "External Company" && (!entry.email || isDirectoryPlaceholderEmail(entry.email));
}
