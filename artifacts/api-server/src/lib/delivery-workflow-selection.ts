import { FinancialControlError } from "./financial-control-contract";
import {
  BIMLOG_DELIVERY_WORKFLOWS,
  deliveryType,
  type DeliveryType,
  type DeliveryWorkflowOption,
} from "./delivery-workflow-defaults";
import {
  deliveryWorkflowFingerprint,
  validateDeliveryWorkflowDefinition,
} from "./delivery-workflow-template-contract";

type Queryable = {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
};

export async function deliveryWorkflowOptions(
  client: Queryable,
  companyId: number,
): Promise<{
  mode: "approved_only" | "defaults_allowed";
  options: DeliveryWorkflowOption[];
}> {
  const policy = (
    await client.query(
      `SELECT mode FROM company_master_catalog_policies WHERE company_id=$1`,
      [companyId],
    )
  ).rows[0];
  const mode =
    policy?.mode === "approved_only" ? "approved_only" : "defaults_allowed";
  const rows = (
    await client.query(
      `SELECT t.id "templateId",t.code,t.name,v.id "versionId",v.version,v.definition,v.fingerprint
    FROM company_delivery_workflow_templates t JOIN company_delivery_workflow_versions v ON v.template_id=t.id
    WHERE t.company_id=$1 AND v.state='published' ORDER BY t.code,v.version DESC`,
      [companyId],
    )
  ).rows;
  const companyOptions = rows.map((row) => {
    const definition = validateDeliveryWorkflowDefinition(row.definition);
    const fingerprint = deliveryWorkflowFingerprint(definition);
    if (fingerprint !== row.fingerprint)
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_FINGERPRINT_MISMATCH",
        "A published Delivery Workflow version failed integrity verification.",
      );
    return {
      versionId: String(row.versionId),
      templateId: String(row.templateId),
      code: String(row.code),
      name: String(row.name),
      version: Number(row.version),
      source: "company" as const,
      definition,
      fingerprint,
    };
  });
  return {
    mode,
    options:
      mode === "approved_only"
        ? companyOptions
        : [...companyOptions, ...BIMLOG_DELIVERY_WORKFLOWS],
  };
}

export function chooseDeliveryWorkflow(
  available: {
    mode: "approved_only" | "defaults_allowed";
    options: DeliveryWorkflowOption[];
  },
  typeInput: unknown,
  selectedVersionIdInput: unknown,
): {
  deliverableType: DeliveryType;
  option: DeliveryWorkflowOption;
  selection: "explicit" | "single_company" | "bimlog_default";
} {
  const deliverableType = deliveryType(typeInput);
  const matching = available.options.filter((option) =>
    option.definition.deliverableTypes.includes(deliverableType),
  );
  const selectedVersionId =
    selectedVersionIdInput == null ? "" : String(selectedVersionIdInput).trim();
  if (selectedVersionId) {
    const option = matching.find(
      (candidate) => candidate.versionId === selectedVersionId,
    );
    if (!option)
      throw new FinancialControlError(
        409,
        "DELIVERY_WORKFLOW_SELECTION_INVALID",
        "The selected Delivery Workflow is unavailable for this company and deliverable type.",
      );
    return { deliverableType, option, selection: "explicit" };
  }
  const company = matching.filter((option) => option.source === "company");
  if (company.length === 1)
    return { deliverableType, option: company[0], selection: "single_company" };
  if (company.length > 1)
    throw new FinancialControlError(
      409,
      "DELIVERY_WORKFLOW_SELECTION_REQUIRED",
      "Multiple company Delivery Workflows match this deliverable. Select one before activation.",
    );
  const builtin = matching.filter((option) => option.source === "bimlog");
  if (builtin.length === 1)
    return { deliverableType, option: builtin[0], selection: "bimlog_default" };
  throw new FinancialControlError(
    409,
    "DELIVERY_WORKFLOW_UNAVAILABLE",
    available.mode === "approved_only"
      ? "Company policy requires an approved Delivery Workflow for this deliverable."
      : "No valid Delivery Workflow is available for this deliverable.",
  );
}
