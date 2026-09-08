import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  jobIntakeCompletion,
  normalizeJobIntakeData,
} from "./job-intake-contract";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) =>
  fs.readFileSync(path.resolve(here, relative), "utf8");
const operationsService = read("./job-operations-service.ts");
const operationsUi = read("../../../bimlog/src/pages/JobOperationsWorkspace.tsx");
const data = normalizeJobIntakeData({
  identity: {
    jobName: "River Avenue",
    jobCode: "1185R",
    clientName: "Example Client",
    clientCompany: "Example Client LLC",
    clientCompanyId: 41,
    primaryContact: "Client Contact",
    primaryContactId: 901,
    currency: "USD",
  },
  relationships: { participants: [
    { id: "CUSTOMER-41", companyId: 41, companyName: "Example Client LLC", role: "customer", primary: true },
    { id: "PROVIDER-7", companyId: 7, companyName: "BIMLog Delivery", role: "service_provider" },
  ], engagements: [{ id: "ENGAGEMENT-1", providerParticipantId: "PROVIDER-7", customerParticipantId: "CUSTOMER-41", providerContactId: 701, customerContactId: 901, description: "BIM coordination" }] },
  scopeItems: [
    {
      id: "SHOP-DRAWINGS",
      name: "Shop drawings",
      plannedHours: "180",
      billingHourlyRate: "30.73",
      apuPlanVersion: 3,
      budgetSnapshotLineId: "budget-line-1",
      projectCostNodeId: "cost-node-1",
      unit: "Hours",
    },
  ],
  commercial: {
    quotationNumber: "Q-100",
    title: "River Avenue base contract",
    contractNumber: "C-100",
    counterpartyName: "Example Client LLC",
    perspective: "upstream",
    contractType: "owner_prime",
    reportingType: "base_contract",
    reportingStatus: "work_in_progress",
    budgetSnapshotId: "snapshot-1",
  },
  delivery: {
    workflowTemplate: "bim-submittal",
    submittalStrategy: "Draft, review, submit, distribute.",
  },
  team: {
    projectLeaderUserId: 5,
    assignments: [
      {
        id: "A-1",
        userId: 5,
        personName: "Coordinator",
        role: "BIM Coordinator",
        scopeItemId: "SHOP-DRAWINGS",
        plannedHours: "180",
        internalHourlyRate: "21.25",
      },
    ],
  },
  review: {
    sourceConfirmed: true,
    scopeConfirmed: true,
    pricingConfirmed: true,
    contractConfirmed: true,
    deliveryConfirmed: true,
    teamConfirmed: true,
  },
});
const completion = jobIntakeCompletion(data, [
  { category: "quotation" },
  { category: "takeoff" },
]);
const coreCapabilities = {
  package: false,
  budget: false,
  contracts: false,
  costValuePlanner: false,
  anyCommercial: false,
  fullCommercialActivation: false,
};
const coreCompletion = jobIntakeCompletion(
  data,
  [{ category: "quotation" }, { category: "takeoff" }],
  coreCapabilities,
);
const sourceOptionalCompletion = jobIntakeCompletion(
  data,
  [],
  coreCapabilities,
);
const incompleteCore = jobIntakeCompletion(
  normalizeJobIntakeData({}),
  [],
  coreCapabilities,
);

assert.equal(
  data.scopeItems[0]?.contractValue,
  "5531.4",
  "billing hourly rate must be the exact commercial joining factor",
);
assert.equal(
  data.team.assignments[0]?.plannedLaborCost,
  "3825",
  "internal hourly cost must be the exact staffing joining factor",
);
assert.equal(completion.totals.contractValue, "5531.4");
assert.equal(completion.totals.plannedLaborCost, "3825");
assert.equal(completion.totals.plannedHours, "180");
assert.equal(completion.totals.unassignedHours, "0");
assert.equal(completion.percent, 100);
assert.equal(completion.ready, true);
assert.match(completion.fingerprint, /^[a-f0-9]{64}$/);
const multiContractData = normalizeJobIntakeData({
  ...data,
  commercial: {
    ...data.commercial,
    contracts: [
      {
        id: "OWNER",
        title: "Owner contract",
        contractNumber: "OWNER-100",
        counterpartyName: "Example Client LLC",
        perspective: "upstream",
        contractType: "owner_prime",
        lifecycleStatus: "executed",
        engagementId: "ENGAGEMENT-1",
      },
      {
        id: "SUPPLIER",
        title: "Supplier contract",
        contractNumber: "PO-200",
        counterpartyName: "Example Supplier LLC",
        perspective: "downstream",
        contractType: "purchase_order",
        reportingType: "change_order",
        reportingStatus: "closed",
        lifecycleStatus: "completed",
        parentContractId: "OWNER",
        engagementId: "ENGAGEMENT-1",
      },
    ],
  },
  scopeItems: [
    { ...data.scopeItems[0], id: "OWNER-ITEM", contractId: "OWNER", responsibleParticipantId: "PROVIDER-7" },
    { ...data.scopeItems[0], id: "SUPPLIER-ITEM", contractId: "SUPPLIER", responsibleParticipantId: "CUSTOMER-41" },
  ],
  team: {
    ...data.team,
    assignments: [
      { ...data.team.assignments[0], id: "OWNER-A", scopeItemId: "OWNER-ITEM" },
      {
        ...data.team.assignments[0],
        id: "SUPPLIER-A",
        scopeItemId: "SUPPLIER-ITEM",
      },
    ],
  },
});
const multiContractCompletion = jobIntakeCompletion(multiContractData, []);
assert.equal(multiContractData.commercial.contracts.length, 2);
assert.equal(multiContractData.commercial.contracts[0].reportingType, "base_contract");
assert.equal(multiContractData.commercial.contracts[1].reportingStatus, "closed");
assert.equal(multiContractData.commercial.contracts[1].parentContractId, "OWNER");
assert.equal(multiContractData.commercial.contracts[0].lifecycleStatus, "executed");
assert.equal(multiContractData.scopeItems[0].responsibleParticipantId, "PROVIDER-7");
assert.throws(() => normalizeJobIntakeData({ commercial: { contracts: [{ id: "CO-1", reportingType: "change_order" }] } }), /parent base agreement/);
assert.deepEqual(
  multiContractData.scopeItems.map((item) => item.contractId),
  ["OWNER", "SUPPLIER"],
);
assert.deepEqual(
  multiContractData.team.assignments.map((assignment: any) => assignment.contractId),
  ["OWNER", "SUPPLIER"],
  "legacy assignments derive their authoritative contract from the selected Contract Item",
);
assert.equal(multiContractCompletion.ready, true);
const multiApuContract = normalizeJobIntakeData({
  commercial: { contracts: [{ id: "BASE", title: "Base agreement" }] },
  scopeItems: [
    { id: "CI-A", name: "Drafting", contractId: "BASE", apuPlanVersion: 3 },
    { id: "CI-B", name: "Coordination", contractId: "BASE", apuPlanVersion: 4 },
  ],
});
assert.deepEqual(multiApuContract.scopeItems.map((item) => item.apuPlanVersion), [3, 4]);
assert.throws(
  () =>
    normalizeJobIntakeData({
      ...multiContractData,
      team: {
        ...multiContractData.team,
        assignments: [
          {
            ...multiContractData.team.assignments[0],
            contractId: "SUPPLIER",
            scopeItemId: "OWNER-ITEM",
          },
        ],
      },
    }),
  /must belong to the assignment's contract profile/,
);
assert.throws(
  () =>
    normalizeJobIntakeData({
      ...data,
      commercial: { ...data.commercial, contracts: [{ id: "ONLY" }] },
      scopeItems: [{ ...data.scopeItems[0], contractId: "MISSING" }],
    }),
  /Every Contract Item must reference a contract profile/,
);
assert.throws(
  () =>
    normalizeJobIntakeData({
      ...data,
      commercial: {
        ...data.commercial,
        contracts: Array.from({ length: 51 }, (_, index) => ({
          id: `CONTRACT-${index + 1}`,
        })),
      },
    }),
  /No more than 50 contract profiles/,
);
assert.throws(
  () =>
    normalizeJobIntakeData({
      ...data,
      commercial: {
        ...data.commercial,
        contracts: [
          { id: "FIRST", perspective: "downstream", contractNumber: "PO-200" },
          {
            id: "SECOND",
            perspective: "downstream",
            contractNumber: " po-200 ",
          },
        ],
      },
    }),
  /Contract profiles must use unique numbers within each perspective/,
);
assert.equal(
  coreCompletion.ready,
  true,
  "core Intake activation must not require paid Commercial features",
);
assert.equal(
  sourceOptionalCompletion.ready,
  true,
  "source documents must remain optional when the user enters and confirms the job data directly",
);
assert.equal(
  sourceOptionalCompletion.stages.find((stage) => stage.key === "documents")
    ?.required,
  false,
);
assert.equal(
  coreCompletion.stages.find((stage) => stage.key === "pricing")?.required,
  false,
);
assert.equal(
  coreCompletion.stages.find((stage) => stage.key === "contract")?.required,
  false,
);
assert.equal(
  incompleteCore.missingItems.every((item) => Boolean(item.en && item.es)),
  true,
  "every visible missing requirement must be bilingual",
);

const migration = read("./job-intake-migration.ts");
const contract = read("./job-intake-contract.ts");
const service = read("./job-intake-service.ts");
const financialContractService = read("./financial-contract-service.ts");
const routes = read("../routes/job-intake.ts");
const app = read("../app.ts");
const ui = read("../../../bimlog/src/pages/JobIntakeWorkspace.tsx");
const bulkEditor = read(
  "../../../bimlog/src/components/job-intake/ContractItemBulkEditor.tsx",
);
const schema = read("../../../../lib/db/src/schema/job-intakes.ts");
assert.doesNotMatch(
  migration,
  /\bDROP\s+(?:TABLE|COLUMN|CONSTRAINT)\b/i,
  "intake migration must remain additive",
);
for (const table of [
  "job_intakes",
  "job_intake_documents",
  "job_intake_events",
  "job_activation_work_items",
  "job_activation_tasks",
  "job_activation_resource_assignments",
])
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
for (const table of [
  "job_activation_work_items",
  "job_activation_tasks",
  "job_activation_resource_assignments",
])
  assert.match(schema, new RegExp(`pgTable\\("${table}"`));
assert.match(
  routes,
  /singleFileUpload\(\{[\s\S]*fileSize: 25 \* 1024 \* 1024,[\s\S]*files: 1,[\s\S]*fields: 3,[\s\S]*parts: 4/,
);
assert.match(routes, /authMiddleware/);
assert.match(routes, /expectedRevision: req\.body\.expectedRevision/);
assert.match(service, /createContractDraftWithClient/);
assert.match(service, /initializeContractItemWorkflowsWithClient/);
assert.match(service, /commercialWorkflowInstances: workflowBaseline\.created/);
assert.match(service, /for \(const contract of data\.commercial\.contracts\)/);
assert.match(service, /stable_scope_item_id=ANY\(\$4::text\[\]\)/);
assert.match(service, /contractIds: drafts\.map/);
assert.match(service, /plannedHours[\s\S]*billingHourlyRate/);
assert.match(service, /createCoreActivationWithClient/);
assert.match(service, /fullCommercialActivation/);
assert.match(service, /job_activation_resource_assignments/);
assert.match(service, /client_name/);
assert.match(service, /\.xlsm/);
assert.match(service, /uploadJobIntakeDocument[\s\S]*FOR UPDATE/);
assert.match(service, /Reload the intake before uploading this document/);
assert.match(service, /previewJobIntakeDocumentMapping/);
assert.match(service, /applyJobIntakeDocumentMapping/);
assert.match(service, /contract_items_imported/);
assert.match(service, /existingById/);
assert.match(service, /provenance: mapped\.provenance/);
assert.match(financialContractService, /CONTRACT_ITEM_APU_CURRENCY_MISMATCH/);
assert.match(routes, /mapping-preview/);
assert.match(routes, /mapping-apply/);
assert.match(contract, /internalHourlyRate/);
assert.match(app, /startJobIntakeMigration\(\)/);
assert.match(app, /await waitForJobIntakeMigration\(\)/);
assert.match(ui, /Core included/);
assert.match(ui, /La Cantidad conecta cada Partida de Contrato/);
assert.match(ui, /Los costos horarios internos son una función opcional/);
assert.match(ui, /Cómputo de cantidades/);
assert.match(ui, /Aún falta/);
assert.match(ui, /missingItems\.map/);
assert.match(ui, /capabilities\.costValuePlanner/);
assert.match(ui, /capabilities\.budget/);
assert.match(ui, /capabilities\.contracts/);
assert.match(ui, /Add contract profile/);
assert.match(ui, /Reassign this contract's Contract Items/);
assert.match(ui, /All changes saved/);
assert.match(ui, /window\.setTimeout\([\s\S]*void persist\(dataRef\.current\)/);
assert.doesNotMatch(
  ui,
  /\(\) => \(\) => \{[\s\S]*void persist\(dataRef\.current\)/,
);
assert.doesNotMatch(ui, /financial\/apu`\)\.catch\(\(\) => null\)/);
assert.doesNotMatch(ui, /financial\/workspace`\)\.catch\(\(\) => null\)/);
assert.match(ui, /saveState === "error"/);
assert.match(ui, /bimlog:job-intake-recovery/);
assert.match(ui, /preserveRecovery\(projectId, revisionRef\.current, data\)/);
assert.match(ui, /clearMatchingRecovery\(projectId, next\)/);
assert.match(ui, /aria-live="polite"/);
assert.match(ui, /formData\.set\("expectedRevision"/);
assert.match(ui, /confirmationFingerprint: saved\.completion\.fingerprint/);
assert.match(ui, /<fieldset className="ji-workspace" disabled=\{busy\}>/);
assert.match(ui, /\.xlsm/);
assert.match(ui, /Inspect & map Contract Items/);
assert.match(ui, /Confirm and append to draft/);
assert.match(ui, /mappingFingerprint: mappingPreview\.mappingFingerprint/);
assert.match(ui, /<ContractItemBulkEditor/);
assert.equal(data.identity.clientCompanyId, 41);
assert.equal(data.identity.primaryContactId, 901);
assert.equal(data.relationships.participants.length, 2);
assert.equal(data.relationships.participants[0]?.companyId, 41);
assert.equal(data.relationships.engagements[0]?.customerContactId, 901);
assert.throws(() => normalizeJobIntakeData({ relationships: { participants: [
  { id: "DUPLICATE", companyId: 1, companyName: "A", role: "customer" },
  { id: "DUPLICATE", companyId: 2, companyName: "B", role: "vendor" },
] } }), /unique stable identifier/);
assert.match(service, /JOB_INTAKE_CLIENT_COMPANY_OUT_OF_SCOPE/);
assert.match(service, /JOB_INTAKE_PRIMARY_CONTACT_OUT_OF_SCOPE/);
assert.match(service, /JOB_INTAKE_PARTICIPANT_OUT_OF_SCOPE/);
assert.match(service, /JOB_INTAKE_ENGAGEMENT_CONTACT_OUT_OF_SCOPE/);
assert.match(service, /parentContractProfileId: contract\.parentContractId/);
assert.match(service, /clientCompanyId: data\.identity\.clientCompanyId/);
assert.match(operationsService, /reportingContracts/);
assert.match(operationsService, /quotationNumber/);
assert.match(operationsUi, /Contract reporting identity/);
assert.match(service, /apuPlanVersions: \[\.\.\.new Set/);
assert.match(operationsService, /apuCount: apuPlanVersions\.length/);
assert.match(ui, /Activate operational job/);
assert.match(ui, /@media\(max-width:900px\)/);
assert.match(bulkEditor, /Paste Excel range/);
assert.match(bulkEditor, /Check row\(s\):/);
assert.match(bulkEditor, /Advanced overrides for row/);
assert.match(bulkEditor, /Contract profile row/);
assert.match(bulkEditor, /MAX_ITEMS = 500/);
assert.match(bulkEditor, /Contract Item Name/);
assert.match(bulkEditor, /Advanced overrides/);
assert.match(bulkEditor, /exactProduct/);
assert.match(bulkEditor, /CI-\$\{crypto\.randomUUID\(\)\}/);

console.log(
  JSON.stringify({
    status: "PASS",
    exactBillingValue: data.scopeItems[0]?.contractValue,
    exactPlannedLaborCost: data.team.assignments[0]?.plannedLaborCost,
    completion: completion.percent,
    tests: [
      "hourly-joining-factor",
      "separate-internal-cost",
      "commercial-completion",
      "core-activation-without-paid-features",
      "optional-source-documents",
      "project-metadata-prefill",
      "debounced-draft-autosave",
      "xlsm-intake",
      "bilingual-requirements",
      "additive-migration",
      "resource-activation",
      "bounded-upload",
      "contract-activation",
      "multi-contract-canonical-activation",
      "automatic-workflow-baseline",
      "startup",
      "bilingual-entitlement-aware-ui",
      "authoritative-company-contact-identifiers",
      "current-project-participant-enforcement",
      "engagement-specific-authoritative-contacts",
      "contract-lifecycle-and-parent-lineage",
      "distinct-filterable-contract-reporting-identity",
      "contract-item-agreement-and-company-ownership",
      "multiple-apus-per-agreement",
    ],
  }),
);
