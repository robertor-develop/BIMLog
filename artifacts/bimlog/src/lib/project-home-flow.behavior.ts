import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { projectHomePhases } from "./project-home-model.ts";

const home = fs.readFileSync(fileURLToPath(new URL("../components/layout/ProjectHome.tsx", import.meta.url)), "utf8");
const progress = fs.readFileSync(fileURLToPath(new URL("../components/layout/ProjectJourneyProgress.tsx", import.meta.url)), "utf8");

assert.deepEqual(projectHomePhases(undefined).map(phase => phase.state), ["current", "upcoming", "upcoming", "upcoming"]);
assert.deepEqual(projectHomePhases("ready").map(phase => phase.state), ["complete", "current", "upcoming", "upcoming"]);
assert.deepEqual(projectHomePhases("activated").map(phase => phase.state), ["complete", "complete", "current", "upcoming"]);
assert.match(progress, /aria-current=\{phase\.state === "current" \? "step"/);
assert.match(home, /aria-disabled="true"/);
assert.match(home, /Start the project from Setup to make work available/);
assert.match(home, /context=project-home&view=manual&from=/);
assert.match(home, /commonTasks\.map/);

console.log("PROJECT_HOME_FLOW_RESULT=PASS lifecycle, availability, shortcuts and contextual help");
