import { createHash } from "node:crypto";

const identity = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const roleCode = /^[A-Z][A-Z0-9_]{1,63}$/;
const currencyCode = /^[A-Z]{3}$/;
const approvalActions = ["create_work_item", "complete_phase", "complete_deliverable", "economic_change", "template_update", "activate_version"] as const;
const changeActions = ["edit_phases", "edit_tasks_roles", "edit_allocation", "change_apu", "edit_approved_work_item", "retire_version"] as const;
const permissionActions = ["view", "edit_draft", "approve", "publish", "manage"] as const;
export const workflowPolicyValidationKeys = ["allocation_total_100", "task_execute_role", "phase_review_role", "final_approval", "required_documents", "valid_apu", "unique_phase_codes"] as const;

type ApprovalAction = typeof approvalActions[number];
type ChangeAction = typeof changeActions[number];
type PermissionAction = typeof permissionActions[number];
type ValidationKey = typeof workflowPolicyValidationKeys[number];

export type WorkflowGovernancePolicy = {
  schemaVersion: 1;
  scope: { allWorkflows: boolean; workflowTemplateIds: string[] };
  approvalRules: Array<{ action: ApprovalAction; roles: string[]; threshold: null | { currency: string; amountMinor: number } }>;
  changeRules: Array<{ action: ChangeAction; allowed: boolean; requiresReapproval: boolean; requiresNewVersion: boolean }>;
  versioning: { lockActivatedSnapshot: true; structuralChangeCreatesVersion: true; preserveHistory: true };
  permissions: Array<{ role: string; actions: PermissionAction[] }>;
  validation: Record<ValidationKey, boolean>;
};

export class WorkflowGovernancePolicyError extends Error {
  constructor(public readonly code: string, public readonly field: string) { super(`${code}: ${field}`); }
}
function bad(field: string): never { throw new WorkflowGovernancePolicyError("WORKFLOW_POLICY_INVALID", field); }
function object(value: unknown, field: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad(field);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !(key in record))) bad(field);
  return record;
}
function list(value: unknown, field: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) bad(field);
  return value;
}
function unique(values: string[], field: string): void { if (new Set(values).size !== values.length) bad(field); }
function identifier(value: unknown, field: string, pattern = identity): string {
  if (typeof value !== "string" || !pattern.test(value)) bad(field);
  return value;
}
function bool(value: unknown, field: string): boolean { if (typeof value !== "boolean") bad(field); return value; }
function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) bad(field);
  return value as T;
}

export function validateWorkflowGovernancePolicy(input: unknown): WorkflowGovernancePolicy {
  const raw = object(input, "definition", ["schemaVersion", "scope", "approvalRules", "changeRules", "versioning", "permissions", "validation"]);
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > 64 * 1024 || raw.schemaVersion !== 1) bad("schemaVersion");
  const scopeInput = object(raw.scope, "scope", ["allWorkflows", "workflowTemplateIds"]);
  const allWorkflows = bool(scopeInput.allWorkflows, "scope.allWorkflows");
  const workflowTemplateIds = list(scopeInput.workflowTemplateIds, "scope.workflowTemplateIds", allWorkflows ? 0 : 1, allWorkflows ? 0 : 50)
    .map((value, index) => identifier(value, `scope.workflowTemplateIds[${index}]`));
  unique(workflowTemplateIds, "scope.workflowTemplateIds");
  const approvalRules = list(raw.approvalRules, "approvalRules", approvalActions.length, approvalActions.length).map((value, index) => {
    const rule = object(value, `approvalRules[${index}]`, ["action", "roles", "threshold"]);
    const action = enumValue(rule.action, approvalActions, `approvalRules[${index}].action`);
    const roles = list(rule.roles, `approvalRules[${index}].roles`, 1, 3).map((role, roleIndex) => identifier(role, `approvalRules[${index}].roles[${roleIndex}]`, roleCode));
    unique(roles, `approvalRules[${index}].roles`);
    let threshold: WorkflowGovernancePolicy["approvalRules"][number]["threshold"] = null;
    if (rule.threshold !== null) {
      const value = object(rule.threshold, `approvalRules[${index}].threshold`, ["currency", "amountMinor"]);
      const currency = identifier(value.currency, `approvalRules[${index}].threshold.currency`, currencyCode);
      if (!Number.isSafeInteger(value.amountMinor) || Number(value.amountMinor) < 0) bad(`approvalRules[${index}].threshold.amountMinor`);
      threshold = { currency, amountMinor: Number(value.amountMinor) };
    }
    return { action, roles, threshold };
  });
  unique(approvalRules.map(rule => rule.action), "approvalRules.action");
  const changeRules = list(raw.changeRules, "changeRules", changeActions.length, changeActions.length).map((value, index) => {
    const rule = object(value, `changeRules[${index}]`, ["action", "allowed", "requiresReapproval", "requiresNewVersion"]);
    const action = enumValue(rule.action, changeActions, `changeRules[${index}].action`);
    const allowed = bool(rule.allowed, `changeRules[${index}].allowed`);
    const requiresReapproval = bool(rule.requiresReapproval, `changeRules[${index}].requiresReapproval`);
    const requiresNewVersion = bool(rule.requiresNewVersion, `changeRules[${index}].requiresNewVersion`);
    if (allowed && ["edit_phases", "change_apu"].includes(action) && !requiresNewVersion) bad(`changeRules[${index}].requiresNewVersion`);
    return { action, allowed, requiresReapproval, requiresNewVersion };
  });
  unique(changeRules.map(rule => rule.action), "changeRules.action");
  const versioning = object(raw.versioning, "versioning", ["lockActivatedSnapshot", "structuralChangeCreatesVersion", "preserveHistory"]);
  for (const key of ["lockActivatedSnapshot", "structuralChangeCreatesVersion", "preserveHistory"] as const) if (versioning[key] !== true) bad(`versioning.${key}`);
  const permissions = list(raw.permissions, "permissions", 1, 20).map((value, index) => {
    const row = object(value, `permissions[${index}]`, ["role", "actions"]);
    const role = identifier(row.role, `permissions[${index}].role`, roleCode);
    const actions = list(row.actions, `permissions[${index}].actions`, 1, permissionActions.length).map((action, actionIndex) => enumValue(action, permissionActions, `permissions[${index}].actions[${actionIndex}]`));
    unique(actions, `permissions[${index}].actions`);
    if (!actions.includes("view")) bad(`permissions[${index}].actions`);
    return { role, actions };
  });
  unique(permissions.map(row => row.role), "permissions.role");
  for (const rule of approvalRules) for (const role of rule.roles) {
    if (!permissions.some(row => row.role === role && row.actions.includes("approve"))) bad(`approvalRules.${rule.action}.roles`);
  }
  if (!permissions.some(row => row.actions.includes("publish"))) bad("permissions.publish");
  const validationInput = object(raw.validation, "validation", [...workflowPolicyValidationKeys]);
  const validation = Object.fromEntries(workflowPolicyValidationKeys.map(key => [key, bool(validationInput[key], `validation.${key}`)])) as WorkflowGovernancePolicy["validation"];
  for (const required of ["allocation_total_100", "task_execute_role", "valid_apu", "unique_phase_codes"] as const) if (!validation[required]) bad(`validation.${required}`);
  return { schemaVersion: 1, scope: { allWorkflows, workflowTemplateIds }, approvalRules, changeRules,
    versioning: { lockActivatedSnapshot: true, structuralChangeCreatesVersion: true, preserveHistory: true }, permissions, validation };
}

export function workflowGovernancePolicyFingerprint(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(validateWorkflowGovernancePolicy(input))).digest("hex");
}

export function workflowPolicyIndependentCheckerAllowed(input: {
  actorUserId: number;
  createdById: number;
  updatedById: number;
}): boolean {
  return Number.isSafeInteger(input.actorUserId) && input.actorUserId > 0 &&
    input.actorUserId !== input.createdById && input.actorUserId !== input.updatedById;
}
