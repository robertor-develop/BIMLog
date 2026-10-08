import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emailReadinessCopy } from "./email-readiness";
import { jobIntakeActivationStructure } from "./job-intake-activation-preview";
import { jobIntakeIsActivated, jobIntakeIsCanonicalReadOnly } from "./job-intake-workspace-state";

const workspace = readFileSync(new URL("../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const commercial = readFileSync(new URL("../components/job-intake/IntakeCommercialReadiness.tsx", import.meta.url), "utf8");
const preview = { workItems: 9, tasks: 9, resourcePlans: 9, namedAssignments: 9, genericResourceDemands: 9, unassignedHours: "9", contractDrafts: 9 };
const receipt = { workItems: [{}], tasks: [{}, {}], assignments: [{}] };

assert.equal(jobIntakeIsActivated({ status: "draft", activation: receipt }), true);
assert.equal(jobIntakeIsActivated({ status: "activated" }), true);
assert.equal(jobIntakeIsActivated({ status: "draft" }), false);
assert.equal(jobIntakeIsCanonicalReadOnly({ status: "draft", activation: receipt, activatedContractId: 77 }), true);
assert.deepEqual(jobIntakeActivationStructure("draft", preview, receipt), {
  mode: "created", workItems: 1, tasks: 2, resourcePlans: 1, namedAssignments: 1,
  genericResourceDemands: 0, unassignedHours: "0", contractDrafts: 0,
});
assert.match(workspace, /const isActivated = jobIntakeIsActivated\(intake\)/);
assert.match(workspace, /What activation created/);
assert.match(workspace, /Add Commercial records to active job/);
assert.match(commercial, /does not activate the job again or replace the work already created/);
assert.equal(emailReadinessCopy("not_configured").label.es, "No configurado");
assert.equal(emailReadinessCopy("error").label.es, "Requiere atención");

console.log("Flow continuity block 08: canonical activation evidence, additive Commercial action, and bilingual email readiness PASS");
