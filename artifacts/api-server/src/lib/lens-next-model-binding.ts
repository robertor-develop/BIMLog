export function normalizeLensNextModelKey(value: unknown): string {
  const key = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length < 3 || key.length > 180)
    throw new Error("invalid_model_binding_key");
  return key;
}

export function selectSingleAuthorizedLensNextBinding(
  existingProjectIds: readonly number[],
  authorizedProjectIds: readonly number[],
): number | null {
  const authorized = new Set(authorizedProjectIds);
  const candidates = [...new Set(existingProjectIds.filter((projectId) => authorized.has(projectId)))];
  return candidates.length === 1 ? candidates[0] : null;
}
