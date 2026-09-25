import { validatePricingTemplate } from "./company-pricing-template-contract";
import { deliveryWorkflowFingerprint, validateDeliveryWorkflowDefinition } from "./delivery-workflow-template-contract";
import { validateWorkflowGovernancePolicy, workflowGovernancePolicyFingerprint } from "./workflow-governance-policy-contract";

const phase = (id: string, code: string, name: string, order: number, tasks: Array<[string, string, string, string[]]>) => ({
  id, code, name, order,
  tasks: tasks.map(([taskId, taskCode, taskName, requiredDocuments], index) => ({
    id: taskId, code: taskCode, name: taskName, order: index + 1, requiredDocuments,
  })),
  completionRule: "all_tasks_reviewed" as const,
  qcRequired: true,
  approvalRequired: true,
});

function workflow(deliverableType: "SHOP_DRAWING" | "SLEEVE", label: string) {
  const slug = deliverableType.toLowerCase();
  return validateDeliveryWorkflowDefinition({
    schemaVersion: 1,
    deliverableTypes: [deliverableType],
    roles: { execute: "DRAFTER", review: "QC_REVIEWER", approve: "PROJECT_LEADER" },
    phases: [
      phase(`${slug}-pre`, "PRE", "Preliminary", 1, [
        [`${slug}-pre-setup`, "SETUP", `Set up ${label}`, []],
        [`${slug}-pre-prepare`, "PREPARE", `Prepare preliminary ${label}`, ["DRAWING"]],
      ]),
      phase(`${slug}-coord`, "COORD", "Coordination", 2, [
        [`${slug}-coord-review`, "COORDINATE", `Coordinate ${label}`, ["DRAWING"]],
        [`${slug}-coord-resolve`, "RESOLVE_CLASHES", "Resolve coordination clashes", ["COORDINATION_RECORD"]],
        [`${slug}-coord-update`, "UPDATE_DRAWING", `Update coordinated ${label}`, ["DRAWING"]],
      ]),
      phase(`${slug}-record`, "FR", "For Record", 3, [
        [`${slug}-record-incorporate`, "INCORPORATE", "Incorporate accepted coordination comments", ["DRAWING"]],
        [`${slug}-record-issue`, "ISSUE", `Issue ${label} for record`, ["DRAWING"]],
      ]),
      phase(`${slug}-built`, "AB", "As-Built", 4, [
        [`${slug}-built-record`, "RECORD_CHANGES", "Record field changes", ["FIELD_RECORD"]],
        [`${slug}-built-final`, "FINAL_PACKAGE", `Complete final ${label} package`, ["DRAWING", "FIELD_RECORD"]],
      ]),
    ],
    transitions: [
      { from: `${slug}-pre`, to: `${slug}-coord`, gate: "qc_approved", requiredDocuments: ["DRAWING"] },
      { from: `${slug}-coord`, to: `${slug}-record`, gate: "qc_approved", requiredDocuments: ["DRAWING", "COORDINATION_RECORD"] },
      { from: `${slug}-record`, to: `${slug}-built`, gate: "approval_granted", requiredDocuments: ["DRAWING"] },
    ],
    reopen: { role: "approve", reasonRequired: true },
  });
}

export const bimtechShopDrawingWorkflow = workflow("SHOP_DRAWING", "shop drawing");
export const bimtechSleeveWorkflow = workflow("SLEEVE", "sleeve drawing");

export const bimtechGovernancePolicy = validateWorkflowGovernancePolicy({
  schemaVersion: 1,
  scope: { allWorkflows: true, workflowTemplateIds: [] },
  approvalRules: [
    { action: "create_work_item", roles: ["PROJECT_LEADER"], threshold: null },
    { action: "complete_phase", roles: ["QC_REVIEWER", "PROJECT_LEADER"], threshold: null },
    { action: "complete_deliverable", roles: ["PROJECT_LEADER"], threshold: null },
    { action: "economic_change", roles: ["OPERATIONS_DIRECTOR", "CEO"], threshold: null },
    { action: "template_update", roles: ["OPERATIONS_DIRECTOR"], threshold: null },
    { action: "activate_version", roles: ["OPERATIONS_DIRECTOR"], threshold: null },
  ],
  changeRules: [
    { action: "edit_phases", allowed: true, requiresReapproval: true, requiresNewVersion: true },
    { action: "edit_tasks_roles", allowed: true, requiresReapproval: true, requiresNewVersion: true },
    { action: "edit_allocation", allowed: true, requiresReapproval: true, requiresNewVersion: true },
    { action: "change_apu", allowed: true, requiresReapproval: true, requiresNewVersion: true },
    { action: "edit_approved_work_item", allowed: false, requiresReapproval: true, requiresNewVersion: true },
    { action: "retire_version", allowed: true, requiresReapproval: true, requiresNewVersion: false },
  ],
  versioning: { lockActivatedSnapshot: true, structuralChangeCreatesVersion: true, preserveHistory: true },
  permissions: [
    { role: "PMO", actions: ["view", "edit_draft", "manage"] },
    { role: "OPERATIONS_DIRECTOR", actions: ["view", "approve", "publish", "manage"] },
    { role: "CEO", actions: ["view", "approve"] },
    { role: "PROJECT_LEADER", actions: ["view", "approve"] },
    { role: "QC_REVIEWER", actions: ["view", "approve"] },
    { role: "DRAFTER", actions: ["view"] },
    { role: "BIM_COORDINATOR", actions: ["view"] },
  ],
  validation: {
    allocation_total_100: true,
    task_execute_role: true,
    phase_review_role: true,
    final_approval: true,
    required_documents: true,
    valid_apu: true,
    unique_phase_codes: true,
  },
});

export const bimtechPricingTemplate = validatePricingTemplate({
  schemaVersion: 1,
  currency: "USD",
  industry: "BIM Services",
  name: "BIMTECH Standard BIM Services APU",
  nodes: [{ id: "contract-value", label: "Contract value (set per contract)", method: "fixed_amount", amount: "0" }],
  economicAllocation: {
    directProductionNodeIds: ["contract-value"],
    phases: [
      { phaseId: "pre", code: "PRE", name: "Preliminary", percent: "45.00" },
      { phaseId: "coord", code: "COORD", name: "Coordination", percent: "35.00" },
      { phaseId: "record", code: "FR", name: "For Record", percent: "15.00" },
      { phaseId: "built", code: "AB", name: "As-Built", percent: "5.00" },
    ],
  },
});

export const bimtechTemplateFingerprints = {
  shopDrawing: deliveryWorkflowFingerprint(bimtechShopDrawingWorkflow),
  sleeve: deliveryWorkflowFingerprint(bimtechSleeveWorkflow),
  governance: workflowGovernancePolicyFingerprint(bimtechGovernancePolicy),
  pricing: bimtechPricingTemplate.fingerprint,
};

export const bimtechApprovedAllocation = {
  laborOperatingPercent: "70.00",
  projectIncentiveReservePercent: "20.00",
  projectEarningsPercent: "10.00",
  directProductionLaborPercent: "85.00",
  projectAdministrativeLaborPercent: "15.00",
};

