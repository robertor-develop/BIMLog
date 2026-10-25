import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/bimlog/src/lib/page-assistant-context.behavior.ts");
const links = fs.readFileSync("artifacts/bimlog/src/components/LinkedItemsPanel.tsx", "utf8");
const submittals = fs.readFileSync("artifacts/bimlog/src/pages/project/SubmittalsTab.tsx", "utf8");
assert.match(links, /\/projects\/\$\{projectId\}\/rfis/);
assert.match(links, /fetch\(`\$\{API\}\/projects\/\$\{projectId\}\/rfis`/);
assert.match(links, /label: mkLabel\(s, "RFI"\)/);
assert.match(submittals, /Primary related RFI/);
assert.match(submittals, /linkedRfiLabel/);
assert.match(submittals, /\{rfi\.number\}: \{rfi\.subject\}/);
assert.match(submittals, /assistantContext/);
console.log("BIMLog GA Build 108: PASS Submittal relationships expose canonical RFI number and title");
