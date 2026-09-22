import {
  decideEdtEnginePermission,
  type EdtEnginePermission,
} from "./edt-engine-permissions";

export const EDT_DEFAULT_ROLE_PROFILES = {
  CEO: ["JOB_OPERATE", "CHANGE_ORDER_APPROVE", "ECONOMIC_ESCALATION_APPROVE"],
  OPERATIONS_DIRECTOR: [
    "JOB_OPERATE",
    "JOB_ACTIVATION_APPROVE",
    "GOVERNED_CHANGE_APPROVE",
    "TIME_APPROVE",
    "QC_DECIDE",
    "TEAM_ASSIGN",
    "TEAM_REASSIGN",
    "WORK_ITEM_MANAGE",
    "WORK_ITEM_ASSIGN",
    "CHANGE_ORDER_REVIEW",
    "CHANGE_ORDER_APPROVE",
    "ECONOMIC_ESCALATION_APPROVE",
    "BUDGET_REDISTRIBUTE",
  ],
  PMO: [
    "JOB_OPERATE",
    "JOB_ACTIVATION_REQUEST",
    "GOVERNED_CHANGE_APPROVE",
    "IMPORT_MANAGE",
    "TEAM_ASSIGN",
    "TEAM_REASSIGN",
    "WORK_ITEM_MANAGE",
    "WORK_ITEM_ASSIGN",
    "TECHNICAL_COORDINATE",
    "CHANGE_ORDER_REVIEW",
    "BUDGET_REDISTRIBUTE",
  ],
  PROJECT_LEADER: [
    "JOB_OPERATE",
    "JOB_ACTIVATION_REQUEST",
    "GOVERNED_CHANGE_REQUEST",
    "TIME_APPROVE",
    "ISSUANCE_SUBMIT",
    "TEAM_ASSIGN",
    "TEAM_REASSIGN",
    "WORK_ITEM_MANAGE",
    "WORK_ITEM_ASSIGN",
    "TECHNICAL_COORDINATE",
    "QC_REVIEW",
    "CHANGE_ORDER_REQUEST",
    "WORK_ITEM_REOPEN_REQUEST",
  ],
  BIM_COORDINATOR: [
    "JOB_OPERATE",
    "GOVERNED_CHANGE_REQUEST",
    "ISSUANCE_SUBMIT",
    "WORK_ITEM_MANAGE",
    "WORK_ITEM_ASSIGN",
    "TECHNICAL_COORDINATE",
    "QC_REVIEW",
    "CHANGE_ORDER_REQUEST",
    "WORK_ITEM_REOPEN_REQUEST",
  ],
  PROJECT_MANAGER: [
    "JOB_OPERATE",
    "GOVERNED_CHANGE_REQUEST",
    "TIME_APPROVE",
    "QC_DECIDE",
    "TEAM_ASSIGN",
    "TEAM_REASSIGN",
    "WORK_ITEM_MANAGE",
    "WORK_ITEM_ASSIGN",
    "TECHNICAL_COORDINATE",
    "QC_REVIEW",
    "QC_APPROVE",
    "CHANGE_ORDER_REQUEST",
    "CHANGE_ORDER_REVIEW",
    "BUDGET_REDISTRIBUTE",
    "WORK_ITEM_REOPEN_REQUEST",
  ],
  DRAFTER: ["JOB_OPERATE", "TIME_SUBMIT", "ISSUANCE_SUBMIT", "WORK_ITEM_REOPEN_REQUEST"],
  QC_MANAGER: [
    "JOB_OPERATE",
    "TIME_APPROVE",
    "QC_DECIDE",
    "QC_REVIEW",
    "QC_APPROVE",
    "QC_INDEPENDENT_APPROVE",
    "CHANGE_ORDER_REVIEW",
  ],
} as const satisfies Record<string, readonly EdtEnginePermission[]>;

export type EdtDefaultRoleProfile = keyof typeof EDT_DEFAULT_ROLE_PROFILES;

export type EdtRecordAuthorizationInput = Readonly<{
  permission: EdtEnginePermission;
  grants: unknown;
  actorUserId: number;
  actorCompanyId: number;
  actorProjectIds: readonly number[];
  recordCompanyId: number;
  recordProjectId: number;
  recordCreatorUserId?: number | null;
  recordRequesterUserId?: number | null;
  eligibleUserIds?: readonly number[];
  conflictUserIds?: readonly number[];
  requireIndependentApprover?: boolean;
}>;

export type EdtRecordAuthorizationDecision = Readonly<{
  allow: boolean;
  code:
    | "AUTHORIZED"
    | "PERMISSION_REQUIRED"
    | "INVALID_PERMISSION_GRANT"
    | "COMPANY_SCOPE_REQUIRED"
    | "PROJECT_SCOPE_REQUIRED"
    | "RECORD_ELIGIBILITY_REQUIRED"
    | "SELF_APPROVAL_PROHIBITED"
    | "CONFLICT_OF_INTEREST"
    | "INDEPENDENT_APPROVER_REQUIRED";
}>;

export function permissionsForDefaultRole(role: EdtDefaultRoleProfile): EdtEnginePermission[] {
  return [...EDT_DEFAULT_ROLE_PROFILES[role]];
}

export function decideEdtRecordAuthorization(
  input: EdtRecordAuthorizationInput,
): EdtRecordAuthorizationDecision {
  const permission = decideEdtEnginePermission(input.grants, input.permission);
  if (!permission.allow) {
    return Object.freeze({
      allow: false,
      code: permission.code === "INVALID_PERMISSION_GRANT"
        ? "INVALID_PERMISSION_GRANT"
        : "PERMISSION_REQUIRED",
    });
  }
  if (input.actorCompanyId !== input.recordCompanyId) {
    return Object.freeze({ allow: false, code: "COMPANY_SCOPE_REQUIRED" });
  }
  if (!input.actorProjectIds.includes(input.recordProjectId)) {
    return Object.freeze({ allow: false, code: "PROJECT_SCOPE_REQUIRED" });
  }
  if (input.eligibleUserIds && !input.eligibleUserIds.includes(input.actorUserId)) {
    return Object.freeze({ allow: false, code: "RECORD_ELIGIBILITY_REQUIRED" });
  }
  if (
    input.recordCreatorUserId === input.actorUserId ||
    input.recordRequesterUserId === input.actorUserId
  ) {
    return Object.freeze({ allow: false, code: "SELF_APPROVAL_PROHIBITED" });
  }
  if (input.conflictUserIds?.includes(input.actorUserId)) {
    return Object.freeze({ allow: false, code: "CONFLICT_OF_INTEREST" });
  }
  if (
    input.requireIndependentApprover &&
    !decideEdtEnginePermission(input.grants, "QC_INDEPENDENT_APPROVE").allow
  ) {
    return Object.freeze({ allow: false, code: "INDEPENDENT_APPROVER_REQUIRED" });
  }
  return Object.freeze({ allow: true, code: "AUTHORIZED" });
}
