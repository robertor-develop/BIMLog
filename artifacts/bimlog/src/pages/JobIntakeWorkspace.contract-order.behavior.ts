import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./JobIntakeWorkspace.tsx", import.meta.url),
  "utf8",
);

const navigationOrder = source.match(/const stages = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
assert.ok(navigationOrder.indexOf('"identity"') < navigationOrder.indexOf('"contract"'));
assert.ok(navigationOrder.indexOf('"contract"') < navigationOrder.indexOf('"scope"'));
assert.doesNotMatch(navigationOrder, /"pricing"/);

assert.match(source, /\.ji-stages>#ji-identity\{order:4\}/);
assert.match(source, /\.ji-stages>#ji-contract\{order:5\}/);
assert.match(source, /\.ji-stages>#ji-scope\{order:6\}/);
assert.match(source, /3\. \{stageLabel\("contract"\)\}/);
assert.match(source, /4–5\. \{stageLabel\("scope"\)\} \+ \{stageLabel\("pricing"\)\}/);

console.log(
  "PASS Advanced Job Intake places Contract setup immediately after Job identity and before Contract Items/APU pricing",
);
