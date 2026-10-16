import assert from "node:assert/strict";
import { GA_PROTECTED_PROJECTS } from "../artifacts/api-server/src/lib/ga-protected-projects.ts";
import { APPROVED_SAMPLE_CODES, reconcileSampleAllowlist } from "./ga-sample-allowlist.mjs";
import { previewSamplePurge } from "./ga-purge-preview.mjs";

const temporary = Object.freeze({
  id: 20000,
  code: "QA-GAUNTLET-1014",
  name: "SYNTHETIC temporary Gauntlet project",
  status: "active",
});
const roster = [
  ...GA_PROTECTED_PROJECTS.map(project => ({ ...project, status: "active" })),
  ...APPROVED_SAMPLE_CODES.map((code, index) => ({ id: 10000 + index, code, name: `SYNTHETIC ${code}`, status: "archived" })),
  temporary,
];
const before = JSON.stringify(roster);
const allowlist = reconcileSampleAllowlist(roster, GA_PROTECTED_PROJECTS);

assert.equal(allowlist.executionAuthorized, false);
assert.ok(!allowlist.candidates.some(project => project.id === temporary.id), "temporary project must never enter the sample purge allowlist implicitly");
assert.deepEqual(allowlist.untouchedProjectIds, [23, 26, 35, temporary.id]);

const incompleteInventory = {
  rosterSha256: allowlist.rosterSha256,
  projects: allowlist.candidates.map(project => ({
    projectId: project.id,
    tables: {},
    objects: [],
    auditEvidenceOutsideDeletionScope: false,
    integrationReferencesVerified: false,
  })),
};
const preview = previewSamplePurge({
  roster,
  inventory: incompleteInventory,
  confirmations: allowlist.candidates,
  expectedRosterSha256: allowlist.rosterSha256,
}, { schemaTableCount: 1, completeProjectDependentTables: ["files"] });

assert.equal(preview.readyForIndependentReview, false);
assert.equal(preview.executionAuthorized, false);
assert.ok(preview.blockers.length > 0, "incomplete custody evidence must produce explicit blockers");
assert.equal(JSON.stringify(roster), before, "readiness evaluation must not mutate project data");

console.log("GA-F05-B034 BLOCKED-SAFE: temporary project deletion remains disabled until complete synthetic ownership, dependency, object and audit evidence exists");
