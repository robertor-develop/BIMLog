import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./JobIntakeWorkspace.tsx", import.meta.url),
  "utf8",
);

const stateSource = readFileSync(new URL("../lib/job-intake-workspace-state.ts", import.meta.url), "utf8");
const navigationOrder = stateSource.match(/jobIntakeStages = \[([\s\S]*?)\]/)?.[1] ?? "";
assert.ok(navigationOrder.indexOf('"identity"') < navigationOrder.indexOf('"contract"'));
assert.ok(navigationOrder.indexOf('"contract"') < navigationOrder.indexOf('"scope"'));
assert.match(source, /jobIntakeStages.filter/);
assert.ok(source.indexOf('id="ji-identity"') < source.indexOf('id="ji-contract"'));
assert.ok(source.indexOf('id="ji-contract"') < source.indexOf('id="ji-scope"'));
assert.match(source, /2\. \{stageLabel\("contract"\)\}/);

console.log(
  "PASS Advanced Job Intake places Contract setup immediately after Job identity and before Contract Items/APU pricing",
);
