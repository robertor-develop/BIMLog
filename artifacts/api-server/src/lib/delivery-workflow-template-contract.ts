import { createHash } from "node:crypto";

const stableId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const roleCode = /^[A-Z][A-Z0-9_]{1,63}$/;
const documentCode = /^[A-Z][A-Z0-9_]{0,63}$/;
const maxDefinitionBytes = 64 * 1024;

export type DeliveryWorkflowTask = {
  id: string;
  code: string;
  name: string;
  order: number;
  requiredDocuments: string[];
};
export type DeliveryWorkflowPhase = {
  id: string;
  code: string;
  name: string;
  order: number;
  tasks: DeliveryWorkflowTask[];
  completionRule: "all_tasks_complete" | "all_tasks_reviewed";
  qcRequired: boolean;
  approvalRequired: boolean;
};
export type DeliveryWorkflowDefinition = {
  schemaVersion: 1;
  deliverableTypes: string[];
  roles: { execute: string; review: string; approve: string };
  phases: DeliveryWorkflowPhase[];
  transitions: Array<{ from: string; to: string; gate: "tasks_complete" | "qc_approved" | "approval_granted"; requiredDocuments: string[] }>;
  reopen: { role: "review" | "approve"; reasonRequired: true };
};

export class DeliveryWorkflowDefinitionError extends Error {
  constructor(public readonly code: string, public readonly field: string) {
    super(`${code}: ${field}`);
  }
}

function fail(code: string, field: string): never { throw new DeliveryWorkflowDefinitionError(code, field); }
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("WORKFLOW_OBJECT_REQUIRED", field);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) fail("WORKFLOW_TEXT_INVALID", field);
  return value.trim();
}
function code(value: unknown, field: string, pattern = stableId): string {
  const result = text(value, field, 100);
  if (!pattern.test(result)) fail("WORKFLOW_CODE_INVALID", field);
  return result;
}
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail("WORKFLOW_BOOLEAN_REQUIRED", field);
  return value;
}
function array(value: unknown, field: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail("WORKFLOW_ARRAY_SIZE_INVALID", field);
  return value;
}
function unique(values: string[], field: string) {
  if (new Set(values).size !== values.length) fail("WORKFLOW_DUPLICATE_ID", field);
}
function documents(value: unknown, field: string): string[] {
  const result = array(value, field, 0, 20).map((item, index) => code(item, `${field}[${index}]`, documentCode));
  unique(result, field);
  return result;
}

export function validateDeliveryWorkflowDefinition(input: unknown): DeliveryWorkflowDefinition {
  const raw = record(input, "definition");
  const serialized = JSON.stringify(raw);
  if (!serialized || Buffer.byteLength(serialized, "utf8") > maxDefinitionBytes) fail("WORKFLOW_DEFINITION_TOO_LARGE", "definition");
  if (raw.schemaVersion !== 1) fail("WORKFLOW_SCHEMA_VERSION_INVALID", "schemaVersion");
  const deliverableTypes = array(raw.deliverableTypes, "deliverableTypes", 1, 20).map((item, index) => code(item, `deliverableTypes[${index}]`));
  unique(deliverableTypes, "deliverableTypes");
  const roleInput = record(raw.roles, "roles");
  const roles = {
    execute: code(roleInput.execute, "roles.execute", roleCode),
    review: code(roleInput.review, "roles.review", roleCode),
    approve: code(roleInput.approve, "roles.approve", roleCode),
  };
  const phaseInput = array(raw.phases, "phases", 1, 24);
  const phases = phaseInput.map((item, phaseIndex) => {
    const phase = record(item, `phases[${phaseIndex}]`);
    const tasks = array(phase.tasks, `phases[${phaseIndex}].tasks`, 1, 100).map((taskItem, taskIndex) => {
      const task = record(taskItem, `phases[${phaseIndex}].tasks[${taskIndex}]`);
      if (task.order !== taskIndex + 1) fail("WORKFLOW_TASK_ORDER_INVALID", `phases[${phaseIndex}].tasks[${taskIndex}].order`);
      return {
        id: code(task.id, `phases[${phaseIndex}].tasks[${taskIndex}].id`),
        code: code(task.code, `phases[${phaseIndex}].tasks[${taskIndex}].code`),
        name: text(task.name, `phases[${phaseIndex}].tasks[${taskIndex}].name`),
        order: task.order,
        requiredDocuments: documents(task.requiredDocuments, `phases[${phaseIndex}].tasks[${taskIndex}].requiredDocuments`),
      };
    });
    unique(tasks.map(task => task.id), `phases[${phaseIndex}].tasks.id`);
    unique(tasks.map(task => task.code), `phases[${phaseIndex}].tasks.code`);
    if (phase.order !== phaseIndex + 1) fail("WORKFLOW_PHASE_ORDER_INVALID", `phases[${phaseIndex}].order`);
    if (phase.completionRule !== "all_tasks_complete" && phase.completionRule !== "all_tasks_reviewed") fail("WORKFLOW_COMPLETION_RULE_INVALID", `phases[${phaseIndex}].completionRule`);
    return {
      id: code(phase.id, `phases[${phaseIndex}].id`),
      code: code(phase.code, `phases[${phaseIndex}].code`),
      name: text(phase.name, `phases[${phaseIndex}].name`),
      order: phase.order,
      tasks,
      completionRule: phase.completionRule as DeliveryWorkflowPhase["completionRule"],
      qcRequired: boolean(phase.qcRequired, `phases[${phaseIndex}].qcRequired`),
      approvalRequired: boolean(phase.approvalRequired, `phases[${phaseIndex}].approvalRequired`),
    };
  });
  unique(phases.map(phase => phase.id), "phases.id");
  unique(phases.map(phase => phase.code), "phases.code");
  unique(phases.flatMap(phase => phase.tasks.map(task => task.id)), "tasks.id");
  const transitions = array(raw.transitions, "transitions", Math.max(0, phases.length - 1), Math.max(0, phases.length - 1)).map((item, index) => {
    const transition = record(item, `transitions[${index}]`);
    if (transition.from !== phases[index].id || transition.to !== phases[index + 1].id) fail("WORKFLOW_TRANSITION_GRAPH_INVALID", `transitions[${index}]`);
    if (transition.gate !== "tasks_complete" && transition.gate !== "qc_approved" && transition.gate !== "approval_granted") fail("WORKFLOW_GATE_INVALID", `transitions[${index}].gate`);
    if (transition.gate === "qc_approved" && !phases[index].qcRequired) fail("WORKFLOW_QC_GATE_UNSUPPORTED", `transitions[${index}].gate`);
    if (transition.gate === "approval_granted" && !phases[index].approvalRequired) fail("WORKFLOW_APPROVAL_GATE_UNSUPPORTED", `transitions[${index}].gate`);
    return { from: phases[index].id, to: phases[index + 1].id, gate: transition.gate as DeliveryWorkflowDefinition["transitions"][number]["gate"], requiredDocuments: documents(transition.requiredDocuments, `transitions[${index}].requiredDocuments`) };
  });
  const reopenInput = record(raw.reopen, "reopen");
  if (reopenInput.role !== "review" && reopenInput.role !== "approve") fail("WORKFLOW_REOPEN_ROLE_INVALID", "reopen.role");
  if (reopenInput.reasonRequired !== true) fail("WORKFLOW_REOPEN_REASON_REQUIRED", "reopen.reasonRequired");
  return { schemaVersion: 1, deliverableTypes, roles, phases, transitions, reopen: { role: reopenInput.role, reasonRequired: true } };
}

export function deliveryWorkflowFingerprint(definition: DeliveryWorkflowDefinition): string {
  return createHash("sha256").update(JSON.stringify(validateDeliveryWorkflowDefinition(definition))).digest("hex");
}

export function boundedDeliveryWorkflowDraft(input: unknown): Record<string, unknown> {
  const value = record(input, "definition");
  const serialized = JSON.stringify(value);
  if (!serialized || Buffer.byteLength(serialized, "utf8") > maxDefinitionBytes) fail("WORKFLOW_DEFINITION_TOO_LARGE", "definition");
  if (value.schemaVersion !== 1) fail("WORKFLOW_SCHEMA_VERSION_INVALID", "schemaVersion");
  return value;
}
