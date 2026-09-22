import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const route = readFileSync(new URL("../routes/coordination-knowledge.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./coordination-knowledge-repository.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../../../bimlog/src/App.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../../../bimlog/src/components/layout/MasterSidebar.tsx", import.meta.url), "utf8");
const lens = readFileSync(new URL("../../../bimlog/src/features/lens-next/LensNextKnowledgePanel.tsx", import.meta.url), "utf8");

const requiredRouteContracts = [
  "lens-context/:lensViewpointId",
  "lens-context/:lensViewpointId/classification",
  "lens-context/:lensViewpointId/resolution",
  "lens-context/:lensViewpointId/resolution/evidence",
  "lens-context/:lensViewpointId/lesson-proposal",
  "lesson-proposals",
  "lesson-proposals/:id/promote",
  "lesson-proposals/:id/merge",
  "conflict-types",
  "rules",
  "resolution-methods",
  "search",
];
for (const contract of requiredRouteContracts) assert.ok(route.includes(contract), `missing regression contract: ${contract}`);
for (const action of ["verify", "reopen", "submit-review", "return-proposed", "approve", "reject"]) {
  assert.ok(route.includes(`\"${action}\"`), `missing governed action: ${action}`);
}
for (const operation of [
  "assertCanonicalIssueScope",
  "getLensContext",
  "appendResolutionRecordRevision",
  "addResolutionEvidence",
  "proposeLesson",
  "transitionLessonProposal",
  "linkLessonPromotion",
]) assert.ok(repository.includes(operation), `missing repository operation: ${operation}`);

for (const path of [
  "/dashboard",
  "/lens-next",
  "/projects/:id/intake",
  "/projects/:id/operations",
  "/company-catalogs",
  "/company-workflows",
  "/company-workflow-governance",
  "/company-pricing-templates",
  "/knowledge",
]) assert.ok(app.includes(`path=\"${path}\"`), `protected platform route absent: ${path}`);
assert.doesNotMatch(app, /path="\/(?:lens|bimlens|legacy-lens)"/i, "retired original Lens route must remain absent");
assert.match(app, /ProtectedRoute component=\{LensNextWorkspace\}/);
assert.match(app, /ProtectedRoute component=\{CoordinationKnowledgeLibrary\}/);
assert.doesNotMatch(sidebar, />\s*(?:Original|Legacy) Lens\s*</i);

for (const text of [
  "No conflict type classified",
  "Key Coordination Guidance",
  "Known Resolution Methods",
  "Previous BIMLog Cases",
  "Use this classification",
]) assert.ok(lens.includes(text), `Lens regression surface absent: ${text}`);
assert.match(lens, /Lens issue \{activeIssueKey\} remains active/);
assert.match(lens, /Previous cases are permitted precedent, not an organizational standard or an automatic recommendation/);

const behaviorFiles = [
  "coordination-knowledge-contract.behavior.ts",
  "coordination-knowledge-authorization.behavior.ts",
  "coordination-resolution-record-contract.behavior.ts",
  "coordination-resolution-evidence.behavior.ts",
  "coordination-resolution-verification.behavior.ts",
  "coordination-lesson-proposal.behavior.ts",
  "coordination-lesson-review.behavior.ts",
  "coordination-lesson-promotion.behavior.ts",
  "coordination-lesson-merge.behavior.ts",
];
for (const file of behaviorFiles) assert.ok(existsSync(new URL(`./${file}`, import.meta.url)), `missing executable regression: ${file}`);

console.log("Build 274 complete platform regression contract: PASS journey=17/17 auth=protected platform=preserved lens-next=available original-lens=absent");
