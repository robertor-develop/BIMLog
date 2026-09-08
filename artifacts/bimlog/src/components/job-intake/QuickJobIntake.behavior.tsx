import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync(new URL("./QuickJobIntake.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");

assert.match(component, /Two-minute start/);
assert.match(component, /Section \$\{step \+ 1\} of 3/);
assert.doesNotMatch(component, /Question \$\{step \+ 1\} of 7/);
assert.match(component, /Job name — required/);
assert.match(component, /Job code — required/);
assert.match(component, /Customer company — required/);
assert.match(component, /First Contract Item — required/);
assert.match(component, /Customer contact — optional now/);
assert.match(component, /Contracts, APUs, documents, delivery, and staffing remain available in Advanced setup/);
assert.match(component, /scopeItems: \[\{ \.\.\.existing, \.\.\.patch \}/);
assert.match(workspace, /const \[quickMode, setQuickMode\] = useState\(\(\) => readSetupMode\(projectId\) === "quick"\)/);
assert.match(workspace, /quickMode \? \(/);
assert.match(workspace, /Back to quick setup/);
assert.match(component, /bimlog:job-intake-quick-step:\$\{projectId\}/);
assert.match(workspace, /bimlog:job-intake-setup-mode:\$\{projectId\}/);
assert.match(workspace, /Needs info/);
assert.match(workspace, /must be complete before activation/);

console.log("quick-job-intake.behavior: PASS three-section default with preserved advanced setup");
