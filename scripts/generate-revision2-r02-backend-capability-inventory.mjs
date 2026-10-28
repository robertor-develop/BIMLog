import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const graphPath = path.join(root, "evidence/stabilization-program-20260919/ROUTE_INTERCONNECTION_GRAPH.json");
const outputPath = path.join(root, "evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json");
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));

function classify(route) {
  const value = route.path.toLowerCase();
  if (value.startsWith("/admin/") || value.startsWith("/super-admin/")) return "administrator_namespace";
  if (/\/projects?\/:/.test(value)) return "project_scoped_namespace";
  if (/\/compan(?:y|ies)\//.test(value)) return "company_scoped_namespace";
  if (/(webhook|callback|oauth|native|lens|connector|integration)/.test(`${value} ${route.owner.toLowerCase()}`)) return "integration_or_native_namespace";
  if (/^(\/health|\/ready|\/live|\/public\/)/.test(value)) return "public_or_operational_namespace";
  return "source_review_required";
}

function capabilityGroup(route) {
  const segments = route.path.split("/").filter(Boolean).filter((value) => !value.startsWith(":"));
  return segments[0] ?? "root";
}

const routes = graph.apiRoutes.map((route) => {
  const authorizationClass = classify(route);
  return {
    identity: `${route.method} ${route.path}`,
    method: route.method,
    path: route.path,
    owner: route.owner,
    capabilityGroup: capabilityGroup(route),
    authorizationClass,
    persistenceTables: route.tables,
    frontendRequirement: authorizationClass === "integration_or_native_namespace"
      ? "intentional_api_native_or_frontend_disposition_required"
      : "intentional_frontend_entry_permission_help_success_error_evidence_required",
    evidenceStatus: "inventoried_not_yet_exposure_adjudicated"
  };
}).sort((a, b) => a.identity.localeCompare(b.identity));

const inventory = {
  schemaVersion: "bimlog-revision2-backend-capability-inventory-v1",
  generatedFrom: "evidence/stabilization-program-20260919/ROUTE_INTERCONNECTION_GRAPH.json",
  productRule: "preserve_capability_and_require_intentional_discoverable_exposure",
  counts: {
    routes: routes.length,
    owners: new Set(routes.map(({ owner }) => owner)).size,
    capabilityGroups: new Set(routes.map(({ capabilityGroup: group }) => group)).size,
    persistenceTables: new Set(routes.flatMap(({ persistenceTables }) => persistenceTables)).size
  },
  routes
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`R02_BACKEND_INVENTORY=WRITTEN routes=${inventory.counts.routes} owners=${inventory.counts.owners} groups=${inventory.counts.capabilityGroups}`);
