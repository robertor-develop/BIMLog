import {
  deliveryWorkflowFingerprint,
  validateDeliveryWorkflowDefinition,
  type DeliveryWorkflowDefinition,
} from "./delivery-workflow-template-contract";
import { FinancialControlError } from "./financial-control-contract";

export type DeliveryWorkflowOption = {
  versionId: string;
  templateId: string | null;
  code: string;
  name: string;
  version: number;
  source: "bimlog" | "company";
  definition: DeliveryWorkflowDefinition;
  fingerprint: string;
};

const general = validateDeliveryWorkflowDefinition({
  schemaVersion: 1,
  deliverableTypes: ["GENERAL"],
  roles: { execute: "EXECUTE", review: "REVIEW", approve: "APPROVE" },
  phases: [
    {
      id: "delivery",
      code: "DELIVERY",
      name: "Delivery",
      order: 1,
      tasks: [
        {
          id: "perform",
          code: "PERFORM",
          name: "Perform the agreed work",
          order: 1,
          requiredDocuments: [],
        },
      ],
      completionRule: "all_tasks_complete",
      qcRequired: false,
      approvalRequired: false,
    },
  ],
  transitions: [],
  reopen: { role: "approve", reasonRequired: true },
});
const shopDrawing = validateDeliveryWorkflowDefinition({
  schemaVersion: 1,
  deliverableTypes: ["SHOP_DRAWING"],
  roles: {
    execute: "DRAFTER",
    review: "QC_REVIEWER",
    approve: "PROJECT_MANAGER",
  },
  phases: [
    {
      id: "preliminary",
      code: "PRE",
      name: "Preliminary",
      order: 1,
      tasks: [
        {
          id: "prepare",
          code: "PREPARE",
          name: "Prepare shop drawing",
          order: 1,
          requiredDocuments: [],
        },
      ],
      completionRule: "all_tasks_complete",
      qcRequired: true,
      approvalRequired: false,
    },
    {
      id: "for_record",
      code: "RECORD",
      name: "For Record",
      order: 2,
      tasks: [
        {
          id: "issue",
          code: "ISSUE",
          name: "Issue approved drawing",
          order: 1,
          requiredDocuments: ["DRAWING"],
        },
      ],
      completionRule: "all_tasks_complete",
      qcRequired: false,
      approvalRequired: true,
    },
  ],
  transitions: [
    {
      from: "preliminary",
      to: "for_record",
      gate: "qc_approved",
      requiredDocuments: [],
    },
  ],
  reopen: { role: "approve", reasonRequired: true },
});
const sleeve = validateDeliveryWorkflowDefinition({
  schemaVersion: 1,
  deliverableTypes: ["SLEEVE"],
  roles: {
    execute: "MODELER",
    review: "QC_REVIEWER",
    approve: "PROJECT_MANAGER",
  },
  phases: [
    {
      id: "layout",
      code: "LAYOUT",
      name: "Sleeve layout",
      order: 1,
      tasks: [
        {
          id: "coordinate",
          code: "COORDINATE",
          name: "Coordinate sleeve locations",
          order: 1,
          requiredDocuments: [],
        },
      ],
      completionRule: "all_tasks_complete",
      qcRequired: true,
      approvalRequired: false,
    },
    {
      id: "release",
      code: "RELEASE",
      name: "Release",
      order: 2,
      tasks: [
        {
          id: "issue",
          code: "ISSUE",
          name: "Issue sleeve layout",
          order: 1,
          requiredDocuments: ["DRAWING"],
        },
      ],
      completionRule: "all_tasks_complete",
      qcRequired: false,
      approvalRequired: true,
    },
  ],
  transitions: [
    {
      from: "layout",
      to: "release",
      gate: "qc_approved",
      requiredDocuments: [],
    },
  ],
  reopen: { role: "approve", reasonRequired: true },
});

function builtin(
  type: string,
  name: string,
  definition: DeliveryWorkflowDefinition,
): DeliveryWorkflowOption {
  return {
    versionId: `bimlog:${type}:1`,
    templateId: null,
    code: type,
    name,
    version: 1,
    source: "bimlog",
    definition,
    fingerprint: deliveryWorkflowFingerprint(definition),
  };
}

export const BIMLOG_DELIVERY_WORKFLOWS: readonly DeliveryWorkflowOption[] =
  Object.freeze([
    builtin("GENERAL", "BIMLog General", general),
    builtin("SHOP_DRAWING", "BIMLog Shop Drawing", shopDrawing),
    builtin("SLEEVE", "BIMLog Sleeve", sleeve),
  ]);
export const DELIVERY_TYPES = ["GENERAL", "SHOP_DRAWING", "SLEEVE"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];
export function deliveryType(value: unknown): DeliveryType {
  const normalized = String(value ?? "GENERAL")
    .trim()
    .toUpperCase();
  if (!DELIVERY_TYPES.includes(normalized as DeliveryType))
    throw new FinancialControlError(
      400,
      "DELIVERY_WORKFLOW_TYPE_INVALID",
      "Choose General, Shop Drawing, or Sleeve.",
    );
  return normalized as DeliveryType;
}
