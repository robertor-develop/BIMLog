import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backend = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json"), "utf8"));
const frontend = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R03_FRONTEND_EXPOSURE_INVENTORY.json"), "utf8"));
const byIdentity = new Map(frontend.entries.map((entry) => [entry.backendIdentity, entry]));
const sourceCache = new Map();
function source(screen) {
  if (!sourceCache.has(screen)) {
    const absolute = path.join(root, screen);
    sourceCache.set(screen, fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "");
  }
  return sourceCache.get(screen);
}
const entries = backend.routes.filter(({ method }) => method !== "GET").map((route) => {
  const exposure = byIdentity.get(route.identity);
  if (!exposure) throw new Error(`missing exposure row for ${route.identity}`);
  const joined = exposure.frontendReferences.map(({ screen }) => source(screen)).join("\n");
  const visibleStates = {
    permission: exposure.frontendReferences.length > 0 && /(permission|role|admin|authoriz|can[A-Z]|disabled)/i.test(joined),
    success: exposure.frontendReferences.length > 0 && /(success|saved|created|updated|deleted|toast)/i.test(joined),
    error: exposure.frontendReferences.length > 0 && /(error|failed|catch\s*\(|isError)/i.test(joined),
    evidence: route.persistenceTables.length > 0 || /(history|audit|receipt|evidence)/i.test(joined)
  };
  return {
    backendIdentity: route.identity,
    owner: route.owner,
    capabilityGroup: route.capabilityGroup,
    authorizationClass: route.authorizationClass,
    disposition: exposure.classification,
    frontendReferences: exposure.frontendReferences,
    visibleStates,
    missingVisibleStates: Object.entries(visibleStates).filter(([, present]) => !present).map(([name]) => name),
    productGap: exposure.classification === "missing-frontend" || Object.values(visibleStates).some((present) => !present),
    noCapabilityLossRule: "retain-mutation-and-distinct-business-semantics-until-visible-state-contract-passes"
  };
});
const result = {
  schemaVersion: "bimlog-revision2-p003-mutation-route-adjudication-v1",
  build: "P003",
  scope: "every non-GET backend capability",
  counts: {
    routes: entries.length,
    withFrontendReference: entries.filter(({ frontendReferences }) => frontendReferences.length).length,
    missingFrontend: entries.filter(({ disposition }) => disposition === "missing-frontend").length,
    productGaps: entries.filter(({ productGap }) => productGap).length
  },
  entries
};
const output = path.join(root, "evidence/revision2-p001-p005/P003_MUTATION_ROUTE_ADJUDICATION.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`P003_MUTATION_ADJUDICATION=WRITTEN routes=${entries.length} referenced=${result.counts.withFrontendReference} gaps=${result.counts.productGaps}`);
