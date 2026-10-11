import assert from "node:assert/strict";
import { deriveAdoptionProgress } from "./adoption-progress";

const base = { emailVerifiedAt: null, workProfile: null, preferredDisciplines: [], preferredDocumentTypes: [], completedSteps: [], completedAt: null, projectCount: 0 };
assert.deepEqual(deriveAdoptionProgress(base), { completed: false, completedCount: 1, percent: 17, nextStage: "verify" });
assert.equal(deriveAdoptionProgress({ ...base, emailVerifiedAt: "2026-10-11T00:00:00Z" }).nextStage, "company");
assert.equal(deriveAdoptionProgress({ ...base, emailVerifiedAt: "x", completedSteps: ["company"] }).nextStage, "project");
assert.equal(deriveAdoptionProgress({ ...base, emailVerifiedAt: "x", completedSteps: ["company"], projectCount: 1 }).nextStage, "control");
assert.equal(deriveAdoptionProgress({ ...base, emailVerifiedAt: "x", completedSteps: ["company"], projectCount: 1, workProfile: "designer", preferredDisciplines: ["Architecture"], preferredDocumentTypes: ["Shop Drawings"] }).nextStage, "first_value");
assert.deepEqual(deriveAdoptionProgress({ ...base, completedAt: "2026-10-11T00:00:00Z" }), { completed: true, completedCount: 6, percent: 100, nextStage: null });
console.log("Simplification and guided adoption build 011 canonical progress: PASS");
