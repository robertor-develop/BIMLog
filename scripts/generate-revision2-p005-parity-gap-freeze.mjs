import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const backend = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json"), "utf8"));
const read = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-p001-p005/P002_READ_ROUTE_ADJUDICATION.json"), "utf8"));
const mutation = JSON.parse(fs.readFileSync(path.join(root, "evidence/revision2-p001-p005/P003_MUTATION_ROUTE_ADJUDICATION.json"), "utf8"));
const all = [...read.entries, ...mutation.entries].sort((a, b) => a.backendIdentity.localeCompare(b.backendIdentity));
const routeDispositions = all.map(({ backendIdentity, disposition }) => ({ backendIdentity, disposition }));
const gaps = all.filter((entry) => entry.productGap).map((entry) => ({
  backendIdentity: entry.backendIdentity,
  disposition: entry.disposition,
  gapType: entry.disposition === "missing-frontend" ? "missing-frontend" : "incomplete-visible-state-contract",
  missingVisibleStates: entry.missingVisibleStates ?? [],
  requiredResolution: entry.disposition === "missing-frontend"
    ? "add-intentional-authorized-frontend-or-prove-api-native-boundary"
    : "complete-permission-success-error-and-evidence-states",
  prohibitedResolution: "delete-hide-vaguely-rename-or-merge-capability"
}));
function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
const result = {
  schemaVersion: "bimlog-revision2-p005-parity-gap-freeze-v1",
  build: "P005",
  frozenAtSourceRouteCount: backend.routes.length,
  permanentGate: {
    everyBackendIdentityAdjudicatedExactlyOnce: true,
    missingFrontendRemainsAProductGap: true,
    apiNativeRequiresExplicitJustification: true,
    noCapabilityMayBeDeletedHiddenOrMergedToCloseAGap: true
  },
  counts: {
    routes: all.length,
    gaps: gaps.length,
    missingFrontend: gaps.filter(({ gapType }) => gapType === "missing-frontend").length,
    incompleteVisibleStateContract: gaps.filter(({ gapType }) => gapType === "incomplete-visible-state-contract").length
  },
  routeDispositionSha256: digest(routeDispositions),
  gapSetSha256: digest(gaps),
  routeDispositions,
  gaps
};
const output = path.join(root, "evidence/revision2-p001-p005/P005_FROZEN_PARITY_GAP_SET.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`P005_GAP_FREEZE=WRITTEN routes=${result.counts.routes} gaps=${result.counts.gaps} sha256=${result.gapSetSha256}`);
