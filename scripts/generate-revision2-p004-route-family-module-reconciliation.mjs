import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backend = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json"), "utf8"));
const read = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-p001-p005/P002_READ_ROUTE_ADJUDICATION.json"), "utf8"));
const mutation = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-p001-p005/P003_MUTATION_ROUTE_ADJUDICATION.json"), "utf8"));
const adjudicated = new Map([...read.entries, ...mutation.entries].map((entry) => [entry.backendIdentity, entry]));
const familyMap = new Map();
for (const route of backend.routes) {
  const key = `${route.capabilityGroup}::${route.owner}`;
  if (!familyMap.has(key)) familyMap.set(key, []);
  familyMap.get(key).push(route);
}
const families = [...familyMap.entries()].map(([familyKey, routes]) => {
  const [capabilityGroup, owner] = familyKey.split("::");
  const dispositions = [...new Set(routes.map(({ identity }) => adjudicated.get(identity)?.disposition))].sort();
  return {
    familyKey,
    moduleIdentity: capabilityGroup,
    sourceOwner: owner,
    routeCount: routes.length,
    routeIdentities: routes.map(({ identity }) => identity).sort(),
    dispositions,
    sharedService: backend.routes.some((candidate) => candidate.capabilityGroup === capabilityGroup && candidate.owner !== owner),
    reconciliationRule: "group-for-discovery-without-merging-route-or-business-identity"
  };
}).sort((a, b) => a.familyKey.localeCompare(b.familyKey));
const modules = [...new Set(families.map(({ moduleIdentity }) => moduleIdentity))].sort().map((moduleIdentity) => ({
  moduleIdentity,
  familyKeys: families.filter((family) => family.moduleIdentity === moduleIdentity).map(({ familyKey }) => familyKey),
  routeCount: families.filter((family) => family.moduleIdentity === moduleIdentity).reduce((sum, family) => sum + family.routeCount, 0),
  preserveDistinctOwners: true
}));
const result = {
  schemaVersion: "bimlog-revision2-p004-route-family-module-reconciliation-v1",
  build: "P004",
  law: "shared-services-may-be-grouped-for-navigation-but-distinct-route-owner-and-business-identities-remain-intact",
  counts: { routes: backend.routes.length, families: families.length, modules: modules.length, sharedServiceFamilies: families.filter(({ sharedService }) => sharedService).length },
  modules,
  families
};
const output = path.join(root, "evidence/revision2-p001-p005/P004_ROUTE_FAMILY_MODULE_RECONCILIATION.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`P004_ROUTE_FAMILIES=WRITTEN routes=${result.counts.routes} families=${result.counts.families} modules=${result.counts.modules}`);
