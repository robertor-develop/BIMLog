export type BindingProject = { id: number; name: string; code: string | null; location?: string | null };

export function normalizeLensNextModelKey(value: unknown): string {
  const key = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || key.length < 3 || key.length > 180)
    throw new Error("invalid_model_binding_key");
  return key;
}

function identityKey(value: string | null): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function uniquePlatformProjectMatch(modelKey: string, projects: readonly BindingProject[]): BindingProject | null {
  const exact = normalizeLensNextModelKey(modelKey);
  const matches = projects.filter((project) => [identityKey(project.code), identityKey(project.name), identityKey(project.location ?? null)]
    .filter((candidate) => candidate.length >= 3)
    .some((candidate) => {
      if (exact === candidate || exact.startsWith(`${candidate}-`) || exact.endsWith(`-${candidate}`) || exact.includes(`-${candidate}-`)) return true;
      const candidateNumber = candidate.match(/^\d{2,}/)?.[0];
      return Boolean(candidateNumber && (exact === candidateNumber || exact.startsWith(`${candidateNumber}-`)));
    }));
  return matches.length === 1 ? matches[0] : null;
}
