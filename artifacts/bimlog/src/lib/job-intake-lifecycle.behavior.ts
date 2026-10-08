import assert from "node:assert/strict";
import { jobIntakeLifecycle, jobIntakeLifecycleCopy } from "./job-intake-lifecycle";

assert.equal(jobIntakeLifecycle("draft", false, "saved", false), "draft");
assert.equal(jobIntakeLifecycle("draft", true, "unsaved", false), "draft");
assert.equal(jobIntakeLifecycle("draft", true, "saved", false), "ready");
assert.equal(jobIntakeLifecycle("draft", true, "saved", true), "activating");
assert.equal(jobIntakeLifecycle("activated", false, "saved", false), "active");
assert.equal(jobIntakeLifecycle("activated", true, "unsaved", false), "changes_pending");
assert.equal(jobIntakeLifecycle("activated", true, "error", false), "changes_pending");
assert.match(jobIntakeLifecycleCopy("active", "en").guidance, /Continue delivery/);
assert.match(jobIntakeLifecycleCopy("changes_pending", "es").guidance, /permanece intacta/);
console.log("Job Intake lifecycle: Draft, Ready, Activating, Active, and Changes pending are distinct PASS");
