export const EDT_ENGINE_PERMISSIONS = [
  "JOB_OPERATE",
  "TEAM_ASSIGN",
  "TEAM_REASSIGN",
  "WORK_ITEM_MANAGE",
  "WORK_ITEM_ASSIGN",
  "TECHNICAL_COORDINATE",
  "QC_REVIEW",
  "QC_APPROVE",
  "QC_INDEPENDENT_APPROVE",
  "CHANGE_ORDER_REQUEST",
  "CHANGE_ORDER_REVIEW",
  "CHANGE_ORDER_APPROVE",
  "ECONOMIC_ESCALATION_APPROVE",
  "BUDGET_REDISTRIBUTE",
  "WORK_ITEM_REOPEN_REQUEST",
] as const;

export type EdtEnginePermission = (typeof EDT_ENGINE_PERMISSIONS)[number];

export type EdtPermissionDecision = Readonly<{
  allow: boolean;
  code: "PERMISSION_GRANTED" | "PERMISSION_REQUIRED" | "INVALID_PERMISSION_GRANT";
  required: EdtEnginePermission;
}>;

const permissionSet = new Set<string>(EDT_ENGINE_PERMISSIONS);

export function isEdtEnginePermission(value: unknown): value is EdtEnginePermission {
  return typeof value === "string" && permissionSet.has(value);
}

export function normalizeEdtEnginePermissions(value: unknown): EdtEnginePermission[] {
  if (!Array.isArray(value)) return [];
  const normalized = new Set<EdtEnginePermission>();
  for (const candidate of value) {
    if (!isEdtEnginePermission(candidate)) return [];
    normalized.add(candidate);
  }
  return EDT_ENGINE_PERMISSIONS.filter((permission) => normalized.has(permission));
}

export function decideEdtEnginePermission(
  grants: unknown,
  required: EdtEnginePermission,
): EdtPermissionDecision {
  if (!Array.isArray(grants) || grants.some((grant) => !isEdtEnginePermission(grant))) {
    return Object.freeze({ allow: false, code: "INVALID_PERMISSION_GRANT", required });
  }
  return Object.freeze({
    allow: grants.includes(required),
    code: grants.includes(required) ? "PERMISSION_GRANTED" : "PERMISSION_REQUIRED",
    required,
  });
}

