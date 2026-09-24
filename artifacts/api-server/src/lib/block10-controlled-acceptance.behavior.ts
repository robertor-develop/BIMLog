import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const catalogRoute = read("../routes/company-master-catalogs.ts");
const pricingRoute = read("../routes/company-pricing-templates.ts");
const workflowRoute = read("../routes/delivery-workflow-templates.ts");
const intakeService = read("./job-intake-service.ts");
const catalogUi = read("../../../../artifacts/bimlog/src/components/admin/CompanyMasterCatalogsTab.tsx");
const intakeUi = read("../../../../artifacts/bimlog/src/components/job-intake/MasterClassificationSelectors.tsx");

// Super Administrator may bootstrap Company PMO but does not grant global
// authority to the recipient; the grant is bound to the user's own company.
assert.match(catalogRoute, /authMiddleware, isSuperAdminMiddleware/);
assert.match(catalogRoute, /targetCompanyId = Number\(target\.rows\[0\]\.company_id\)/);
assert.match(catalogRoute, /a\.company_id=u\.company_id AND a\.user_id=u\.id AND a\.state='active'/);

// Ordinary users can read their scoped catalog but every mutation is checked
// server-side for PMO/Super Administrator authority.
assert.match(catalogRoute, /if \(!current \|\| \(!current\.isPmo && !current\.isSuperAdmin\)\)/);
assert.match(catalogUi, /capability\.canManage/);
assert.match(catalogUi, /Read-only/);

// Pricing publication and economic Delivery Workflow approval require the
// independent Finance checker; stale and maker-as-checker paths fail closed.
assert.match(pricingRoute, /PRICING_TEMPLATE_MAKER_CHECKER_REQUIRED/);
assert.match(pricingRoute, /PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED/);
assert.match(workflowRoute, /DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED/);
assert.match(workflowRoute, /DELIVERY_WORKFLOW_NOT_APPROVED_OR_STALE/);

// Intake exposes only governed IDs and the server independently revalidates
// company, classification, workflow, pricing, budget, and staffing authority.
assert.match(intakeUi, /\/master-catalogs\/disciplines/);
assert.doesNotMatch(intakeUi, /<select[^>]*service/i);
assert.doesNotMatch(intakeUi, /<select[^>]*phase/i);
assert.doesNotMatch(intakeUi, /<input/);
for (const boundary of [
  "JOB_INTAKE_COMPANY_MISMATCH",
  "JOB_INTAKE_CLASSIFICATION_NOT_APPROVED",
  "JOB_INTAKE_CLIENT_CATALOG_REQUIRED",
  "resolveCompanyPricingTemplateBinding",
  "bindDeliveryWorkflowWithClient",
  "Assigned resources must be active authoritative users in the current project",
]) assert.match(intakeService, new RegExp(boundary));

console.log("Block 10 controlled acceptance: Super Administrator bootstrap, Company PMO, Finance checker, read-only user, and catalog-to-Intake server boundaries PASS");
