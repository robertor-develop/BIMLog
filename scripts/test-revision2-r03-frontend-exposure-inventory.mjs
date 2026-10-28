import assert from "node:assert/strict";
import fs from "node:fs";

const backend = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json", import.meta.url)));
const frontend = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R03_FRONTEND_EXPOSURE_INVENTORY.json", import.meta.url)));
const allowed = new Set(frontend.classificationVocabulary);

assert.equal(frontend.entries.length, backend.routes.length);
assert.equal(new Set(frontend.entries.map(({ backendIdentity }) => backendIdentity)).size, backend.routes.length);
assert.ok(frontend.entries.every(({ classification }) => allowed.has(classification)));
assert.ok(frontend.entries.every(({ requiredFollowUp }) => requiredFollowUp.length > 0));
assert.equal(frontend.navigationEvidence.searchableAllToolsEntry, false);
assert.equal(frontend.navigationEvidence.disposition, "confirmed_global_discoverability_gap");
assert.ok(frontend.counts["missing-frontend"] > 0, "unexposed candidates must remain visible as product gaps pending adjudication");
assert.ok(frontend.limitations.some((value) => value.includes("No capability may be removed")));
const livingBrief = frontend.entries.find(({ backendIdentity }) => backendIdentity === "GET /living-brief/eligibility");
assert.ok(livingBrief?.frontendReferences.some(({ apiPath }) => apiPath === "${API_BASE}/api/v1/living-brief/eligibility"), "dynamic API base references must resolve to their backend route");
const notifications = frontend.entries.find(({ backendIdentity }) => backendIdentity === "GET /notifications");
assert.ok(notifications?.frontendReferences.some(({ apiPath }) => apiPath === "${API_BASE}/api/v1/notifications"), "dynamic notification base must be recognized");

const total = frontend.classificationVocabulary.reduce((sum, key) => sum + frontend.counts[key], 0);
assert.equal(total, frontend.counts.backendCapabilities);
console.log(`REVISION2_R03=PASS capabilities=${total} directReferences=${frontend.counts.directFrontendReferences} missingCandidates=${frontend.counts["missing-frontend"]} allTools=missing`);
