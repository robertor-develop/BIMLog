export const PROJECT_ROLES = ["project_admin", "convention_manager", "discipline_lead", "member", "drafter", "sub_trade", "read_only"] as const;
export type ProjectRole = typeof PROJECT_ROLES[number];

const LEGACY: Readonly<Record<string, ProjectRole>> = Object.freeze({
  admin: "project_admin",
  owner: "project_admin",
  viewer: "read_only",
  reviewer: "read_only",
});

export function canonicalProjectRole(value: unknown): ProjectRole | null {
  const role = String(value ?? "").trim().toLowerCase();
  if ((PROJECT_ROLES as readonly string[]).includes(role)) return role as ProjectRole;
  return LEGACY[role] ?? null;
}

export function isWritableProjectRole(value: unknown): boolean {
  const role = canonicalProjectRole(value);
  return role !== null && role !== "read_only" && role !== "sub_trade";
}
