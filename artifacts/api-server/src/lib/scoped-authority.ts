export type CurrentProjectRole = "project_admin" | "convention_manager" | "discipline_lead" | "member" | "sub_trade" | "read_only";
export type LegacyProjectRole = "admin" | "viewer";
export type CurrentPermissionCategory = "admin" | "write" | "read";

export interface ScopedAuthorityMapping {
  knownRole: boolean;
  role: string;
  permissionCategory: CurrentPermissionCategory | null;
  authorities: string[];
}

const ROLE_AUTHORITIES: Record<CurrentProjectRole | LegacyProjectRole, readonly string[]> = {
  project_admin: ["project:admin", "project:write", "project:read", "convention:manage", "discipline:lead", "coordination:upload"],
  convention_manager: ["project:write", "project:read", "convention:manage", "coordination:upload"],
  discipline_lead: ["project:write", "project:read", "discipline:lead", "coordination:upload"],
  member: ["project:write", "project:read", "coordination:upload"],
  sub_trade: ["project:read", "coordination:upload"],
  read_only: ["project:read"],
  admin: ["project:admin", "project:write", "project:read", "convention:manage", "discipline:lead", "coordination:upload"],
  viewer: ["project:read"],
};

const PERMISSION_CEILINGS: Record<CurrentPermissionCategory, ReadonlySet<string>> = {
  admin: new Set(["project:admin", "project:write", "project:read", "convention:manage", "discipline:lead", "coordination:upload"]),
  write: new Set(["project:write", "project:read", "convention:manage", "discipline:lead", "coordination:upload"]),
  read: new Set(["project:read"]),
};

export const CURRENT_PROJECT_ROLES = Object.freeze(["project_admin", "convention_manager", "discipline_lead", "member", "sub_trade", "read_only"] as const);
export const LEGACY_PROJECT_ROLE_ALIASES = Object.freeze(["admin", "viewer"] as const);

export function mapCurrentProjectRole(role: string | null | undefined, permissionCategory?: string | null): ScopedAuthorityMapping {
  const key = String(role ?? "");
  if (!Object.prototype.hasOwnProperty.call(ROLE_AUTHORITIES, key)) {
    return { knownRole: false, role: key, permissionCategory: null, authorities: [] };
  }
  const category = permissionCategory === undefined
    ? null
    : (typeof permissionCategory === "string" && ["admin", "write", "read"].includes(permissionCategory) ? permissionCategory as CurrentPermissionCategory : undefined);
  if (category === undefined) return { knownRole: true, role: key, permissionCategory: null, authorities: [] };
  const maximum = ROLE_AUTHORITIES[key as CurrentProjectRole | LegacyProjectRole];
  const authorities = category ? maximum.filter((authority) => PERMISSION_CEILINGS[category].has(authority)) : [...maximum];
  return { knownRole: true, role: key, permissionCategory: category, authorities };
}

export function hasScopedAuthority(mapping: ScopedAuthorityMapping, required: readonly string[]): boolean {
  return mapping.knownRole && required.some((authority) => mapping.authorities.includes(authority));
}
