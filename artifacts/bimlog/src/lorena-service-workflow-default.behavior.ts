import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hydrateSelectedDeliveryWorkflowGuidance } from "./lib/job-intake-delivery-defaults";

const workflow = {
  versionId: "workflow-shop-v4",
  source: "company",
  serviceEntryIds: ["service-shop"],
  definition: {
    deliverableTypes: ["SHOP_DRAWING"],
    phases: [
      { name: "PRE", tasks: [{ name: "Prepare" }] },
      { name: "COO", tasks: [{ name: "Coordinate" }] },
      { name: "FOR", tasks: [{ name: "Issue for record" }] },
      { name: "ASB", tasks: [{ name: "As-built" }] },
    ],
  },
};
const unbound = { id: "CI-1", deliverableType: "GENERAL", deliveryWorkflowVersionId: "", classification: { serviceId: "service-shop" }, submittalStrategy: "", milestoneSummary: "" };
const applied = hydrateSelectedDeliveryWorkflowGuidance([unbound], [workflow])[0]!;
assert.equal(applied.deliveryWorkflowVersionId, workflow.versionId);
assert.equal(applied.deliverableType, "SHOP_DRAWING");
assert.equal(applied.submittalStrategy, "Prepare → Coordinate → Issue for record → As-built");
assert.equal(applied.milestoneSummary, "PRE → COO → FOR → ASB");

const reviewed = { ...unbound, submittalStrategy: "Customer-reviewed strategy", milestoneSummary: "Reviewed milestones" };
const preserved = hydrateSelectedDeliveryWorkflowGuidance([reviewed], [workflow])[0]!;
assert.equal(preserved.submittalStrategy, reviewed.submittalStrategy);
assert.equal(preserved.milestoneSummary, reviewed.milestoneSummary);

const explicitlyBound = { ...unbound, deliveryWorkflowVersionId: "workflow-existing", submittalStrategy: "Existing", milestoneSummary: "Existing" };
assert.deepEqual(hydrateSelectedDeliveryWorkflowGuidance([explicitlyBound], [workflow])[0], explicitlyBound);

const ambiguous = hydrateSelectedDeliveryWorkflowGuidance([unbound], [workflow, { ...workflow, versionId: "workflow-shop-v5" }])[0]!;
assert.equal(ambiguous.deliveryWorkflowVersionId, "");

const outsider = hydrateSelectedDeliveryWorkflowGuidance([{ ...unbound, classification: { serviceId: "foreign-service" } }], [workflow])[0]!;
assert.equal(outsider.deliveryWorkflowVersionId, "");

const root = new URL("../../../", import.meta.url);
const migration = readFileSync(new URL("artifacts/api-server/src/lib/delivery-workflow-template-migration.ts", root), "utf8");
const route = readFileSync(new URL("artifacts/api-server/src/routes/company-master-catalogs.ts", root), "utf8");
const selection = readFileSync(new URL("artifacts/api-server/src/lib/delivery-workflow-selection.ts", root), "utf8");
assert.match(migration, /company_service_delivery_workflow_bindings/);
assert.match(route, /kind='service' AND state='active'/);
assert.match(route, /t\.company_id=\$2 AND v\.state='published'/);
assert.match(route, /SERVICE_WORKFLOW_BINDING_STALE/);
assert.match(selection, /binding\.company_id=t\.company_id/);
console.log("Lorena service workflow default behavior passed: 10 checks");
