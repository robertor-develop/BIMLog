import { FinancialControlError } from "./financial-control-contract";

export const WORKFLOW_NODE_TYPES = ["phase", "revision", "version", "task"] as const;
export const WORKFLOW_NODE_STATUSES = ["not_started", "in_progress", "blocked", "complete", "cancelled"] as const;
export type WorkflowNodeType = typeof WORKFLOW_NODE_TYPES[number];
export type WorkflowNodeStatus = typeof WORKFLOW_NODE_STATUSES[number];

const parents: Record<WorkflowNodeType, WorkflowNodeType | null> = {
  phase: null,
  revision: "phase",
  version: "revision",
  task: "version",
};

export function workflowNodeType(value: unknown): WorkflowNodeType {
  const type = String(value);
  if (!(WORKFLOW_NODE_TYPES as readonly string[]).includes(type))
    throw new FinancialControlError(400, "WORKFLOW_NODE_TYPE_INVALID", "Workflow node type is invalid.");
  return type as WorkflowNodeType;
}

export function workflowNodeStatus(value: unknown): WorkflowNodeStatus {
  const status = String(value);
  if (!(WORKFLOW_NODE_STATUSES as readonly string[]).includes(status))
    throw new FinancialControlError(400, "WORKFLOW_STATUS_INVALID", "Workflow status is invalid.");
  return status as WorkflowNodeStatus;
}

export function requiredWorkflowParent(type: WorkflowNodeType) {
  return parents[type];
}

export function assertWorkflowParent(type: WorkflowNodeType, parentType: WorkflowNodeType | null) {
  if (parents[type] !== parentType)
    throw new FinancialControlError(400, "WORKFLOW_PARENT_INVALID", type === "phase" ? "A phase must be a root workflow item." : `A ${type} must belong to a ${parents[type]}.`);
}

export function defaultWorkflowPhases(templateKey: string) {
  return templateKey === "bim-submittal" ? ["Preliminary", "Coordination", "For Record", "As-Built"] : ["Phase 1"];
}
