import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/bimlog/src/lib/page-assistant-context.behavior.ts");
const source = fs.readFileSync("artifacts/bimlog/src/pages/project/SubmittalsTab.tsx", "utf8");
for (const label of ["Number", "Title", "Primary related RFI"]) {
  assert.match(source, new RegExp(`InfoRow label=\\{w\\("${label}"[^\\n]+assistantContext`));
}
assert.match(source, /data-assistant-context=\{assistantContext \? "true" : undefined\}/);
console.log("BIMLog GA Build 109: PASS page assistant receives exact Submittal and linked-RFI grounding");
