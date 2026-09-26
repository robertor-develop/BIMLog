/** One bounded tag contract for preview and confirmed publication. Never coerce file IDs. */
export function validFolderWizardTags(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const entries = Object.entries(value);
  return entries.length <= 64 && entries.every(([key, tag]) =>
    /^[a-z][a-z0-9_]{0,63}$/.test(key) && !["constructor", "prototype", "__proto__"].includes(key) &&
    typeof tag === "string" && tag.length <= 160);
}

export function validFolderWizardFileId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
