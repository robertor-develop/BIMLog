import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backend = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json"), "utf8"));
const frontend = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R03_FRONTEND_EXPOSURE_INVENTORY.json"), "utf8"));
const byIdentity = new Map(frontend.entries.map((entry) => [entry.backendIdentity, entry]));
const entries = backend.routes.filter(({ method }) => method === "GET").map((route) => {
  const exposure = byIdentity.get(route.identity);
  if (!exposure) throw new Error(`missing exposure row for ${route.identity}`);
  return {
    backendIdentity: route.identity,
    owner: route.owner,
    capabilityGroup: route.capabilityGroup,
    authorizationClass: route.authorizationClass,
    disposition: exposure.classification,
    frontendReferences: exposure.frontendReferences,
    operability: exposure.frontendReferences.length ? "frontend-entry-evidenced" : "no-frontend-entry-evidenced",
    productGap: exposure.classification === "missing-frontend",
    noCapabilityLossRule: "retain-route-and-business-identity-until-intentional-exposure-is-delivered"
  };
});
const dispositions = frontend.classificationVocabulary;
const counts = Object.fromEntries(dispositions.map((value) => [value, entries.filter(({ disposition }) => disposition === value).length]));
const result = {
  schemaVersion: "bimlog-revision2-p002-read-route-adjudication-v1",
  build: "P002",
  scope: "every GET backend capability",
  dispositions,
  counts: { routes: entries.length, productGaps: entries.filter(({ productGap }) => productGap).length, ...counts },
  entries
};
const output = path.join(root, "evidence/revision2-p001-p005/P002_READ_ROUTE_ADJUDICATION.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`P002_READ_ADJUDICATION=WRITTEN routes=${entries.length} gaps=${result.counts.productGaps}`);
