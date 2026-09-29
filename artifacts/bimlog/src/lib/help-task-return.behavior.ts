import assert from "node:assert/strict";
import { journeyDestination, safeHelpReturn } from "./task-journeys";
const intake = "/projects/42/intake?stage=delivery&item=ji-contract";
assert.equal(safeHelpReturn(intake), intake);
assert.equal(journeyDestination(intake, "convention"), `/projects/42/convention?returnTo=${encodeURIComponent(intake)}`);
assert.equal(safeHelpReturn("//evil.test/projects/42/intake"), "/dashboard");
assert.equal(safeHelpReturn("/projects/other/intake"), "/dashboard");
console.log("help task return behavior: PASS");
