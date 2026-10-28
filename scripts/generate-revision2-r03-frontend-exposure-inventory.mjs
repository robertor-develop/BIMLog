import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const graph = JSON.parse(fs.readFileSync(path.join(root, "evidence/stabilization-program-20260919/ROUTE_INTERCONNECTION_GRAPH.json"), "utf8"));
const backend = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json"), "utf8"));
const output = path.join(root, "evidence/revision2-r01-r05/R03_FRONTEND_EXPOSURE_INVENTORY.json");

function clean(value) {
  const apiRoot = value.match(/\/api\/v\d+(?:\/|$)/)?.index;
  const rooted = apiRoot === undefined ? value : value.slice(apiRoot);
  return rooted.replace(/^\/api\/v\d+/, "").replace(/\?.*$/, "").replace(/\/$/, "") || "/";
}
function matches(routePath, apiPath) {
  const expected = clean(routePath).split("/").filter(Boolean);
  const actual = clean(apiPath).split("/").filter(Boolean);
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) => segment.startsWith(":") || segment === actual[index]);
}

const entries = backend.routes.map((route) => {
  const references = graph.apiReferences.filter((reference) => matches(route.path, reference.apiPath));
  let classification;
  if (route.authorizationClass === "administrator_namespace" && references.length) classification = "administrator-only";
  else if (references.length && route.method === "GET") classification = "read-only";
  else if (references.length) classification = "fully-operable";
  else if (route.authorizationClass === "integration_or_native_namespace") classification = "intentionally-api-native-only";
  else classification = "missing-frontend";
  return {
    backendIdentity: route.identity,
    capabilityGroup: route.capabilityGroup,
    classification,
    frontendReferences: references.map(({ screen, apiPath }) => ({ screen, apiPath })),
    evidenceConfidence: references.length ? "direct-static-reference" : "candidate-requires-source-adjudication",
    requiredFollowUp: classification === "missing-frontend"
      ? "prove_existing_dynamic_frontend_or_add_visible_authorized_entry_help_success_error_evidence"
      : classification === "intentionally-api-native-only"
        ? "document_and_justify_api_native_boundary"
        : "verify_end_to_end_operability_and_permission_states"
  };
});

const classifications = ["fully-operable", "read-only", "partially-exposed", "administrator-only", "intentionally-api-native-only", "missing-frontend"];
const counts = Object.fromEntries(classifications.map((name) => [name, entries.filter(({ classification }) => classification === name).length]));
const inventory = {
  schemaVersion: "bimlog-revision2-frontend-exposure-inventory-v1",
  generatedFrom: [
    "evidence/stabilization-program-20260919/ROUTE_INTERCONNECTION_GRAPH.json",
    "evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json"
  ],
  classificationVocabulary: classifications,
  navigationEvidence: {
    frontendRoutes: graph.counts.frontendRoutes,
    projectTabs: graph.counts.projectTabs,
    sidebarTabs: graph.counts.sidebarTabs,
    sidebarLinks: graph.counts.sidebarLinks,
    searchableAllToolsEntry: false,
    disposition: "confirmed_global_discoverability_gap"
  },
  limitations: [
    "Static references do not prove complete user operability or lifecycle-state comprehension.",
    "Candidate missing-frontend entries require source adjudication because dynamic URL construction may not appear as an exact static reference.",
    "No capability may be removed or merged solely because its frontend exposure is incomplete."
  ],
  counts: { backendCapabilities: entries.length, directFrontendReferences: graph.apiReferences.length, ...counts },
  entries
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`R03_FRONTEND_EXPOSURE=WRITTEN capabilities=${entries.length} references=${graph.apiReferences.length} missingCandidates=${counts["missing-frontend"]}`);
