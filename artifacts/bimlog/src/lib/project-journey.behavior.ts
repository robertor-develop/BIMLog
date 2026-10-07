import assert from "node:assert/strict";
import { projectHomePath, projectJourneyAction } from "./project-journey.ts";

assert.equal(projectHomePath(63), "/projects/63");
assert.deepEqual(projectJourneyAction(63, { intake: null }).state, "setup_not_started");
assert.deepEqual(projectJourneyAction(63, { status: "draft", intake: {} }).href, "/projects/63/intake");
assert.deepEqual(projectJourneyAction(63, { status: "ready", intake: {} }).href, "/projects/63/intake#ji-review");
assert.deepEqual(projectJourneyAction(63, { status: "activated", intake: {} }).href, "/projects/63/operations");
console.log("PROJECT_JOURNEY_RESULT=PASS canonical project home and deterministic next action");
