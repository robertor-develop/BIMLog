import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PageAssistant.tsx", import.meta.url), "utf8");

assert.doesNotMatch(source, /127\.0\.0\.1:8789/, "browser clients must never call a device-local MAIN 04 bridge");
assert.match(source, /\/api\/v1\/assistant\/ask/, "global questions must use the authenticated BIMLog API");
assert.match(source, /\/api\/v1\/projects\/\$\{currentContext\.projectId\}\/assistant\/ask/, "project questions must use the project-scoped authenticated BIMLog API");
assert.match(source, /data\.agent\?\.threadId/, "the hosted MAIN 04 identity must be verified");
assert.match(source, /setRepairLoadError\(/, "repair-status loading must keep its own error state");
const repairLoader = source.match(/async function loadRepairs\(\)([\s\S]*?)\n  async function ask/)?.[1] ?? "";
assert.doesNotMatch(repairLoader, /setError\(/, "background repair polling must not overwrite the conversation result");

console.log("Hosted page-assistant transport: PASS");
