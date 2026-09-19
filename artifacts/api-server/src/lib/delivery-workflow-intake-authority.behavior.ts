import assert from "node:assert/strict";
import fs from "node:fs";
import { BIMLOG_DELIVERY_WORKFLOWS } from "./delivery-workflow-defaults";
import { chooseDeliveryWorkflow } from "./delivery-workflow-selection";

const selection = fs.readFileSync(new URL("./delivery-workflow-selection.ts", import.meta.url), "utf8");
const templates = fs.readFileSync(new URL("../routes/delivery-workflow-templates.ts", import.meta.url), "utf8");
const policies = fs.readFileSync(new URL("../routes/workflow-governance-policies.ts", import.meta.url), "utf8");
const intake = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("./delivery-workflow-runtime.ts", import.meta.url), "utf8");

assert.match(selection, /v\.state='published'/);
assert.match(selection, /company_master_catalog_policies WHERE company_id=\$1/);
assert.match(selection, /DELIVERY_WORKFLOW_FINGERPRINT_MISMATCH/);
assert.match(selection, /mode === "approved_only"/);
assert.match(templates, /DELIVERY_WORKFLOW_PMO_REQUIRED/);
assert.match(templates, /DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED/);
assert.match(templates, /economicCheckerAllowed/);
assert.match(templates, /state='superseded'/);
assert.match(policies, /v\.state='published'/);
assert.match(policies, /policiesOverlap/);
assert.match(policies, /state='superseded'/);
assert.match(intake, /bindDeliveryWorkflowWithClient/);
assert.match(runtime, /deliveryWorkflowOptions/);
assert.match(runtime, /chooseDeliveryWorkflow/);

const company = {
  ...BIMLOG_DELIVERY_WORKFLOWS[0],
  versionId: "company-general-v3",
  templateId: "company-general",
  source: "company" as const,
};
assert.equal(chooseDeliveryWorkflow({ mode: "approved_only", options: [company] }, "GENERAL", company.versionId).option.source, "company");
assert.throws(() => chooseDeliveryWorkflow({ mode: "approved_only", options: [company] }, "SHOP_DRAWING", ""), /approved Delivery Workflow/);
assert.throws(() => chooseDeliveryWorkflow({ mode: "approved_only", options: [company] }, "GENERAL", "bimlog:GENERAL:1"), /unavailable/);

console.log("Delivery Workflow Intake authority: published-only company definitions, governed defaults, fingerprint verification, policy overlap, and authorization gates PASS");
