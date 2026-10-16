import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./test-release-integrity-block02-build008-agent-contract.mjs";
import "./test-release-integrity-block02-build009-agent-width-fit.mjs";

const panel = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
assert.match(panel, /function closeAssistant\(\)\{setOpen\(false\);window\.setTimeout\(\(\)=>opener\.current\?\.focus\(\),0\);\}/);
assert.match(panel, /event\.key==="Escape"&&open\)\{event\.preventDefault\(\);closeAssistant\(\);/);
assert.match(panel, /aria-label=\{tt\("Agent window controls"/);
assert.match(panel, /onClick=\{closeAssistant\}/);
assert.match(panel, /aria-busy=\{busy\}/);
console.log("PASS build 010: Agent dock acceptance and focus recovery");
