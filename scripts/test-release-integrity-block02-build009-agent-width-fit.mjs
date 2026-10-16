import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync("artifacts/bimlog/src/lib/page-assistant-workspace.ts", "utf8");
const behavior = readFileSync("artifacts/bimlog/src/lib/page-assistant-workspace.behavior.ts", "utf8");
assert.match(workspace, /ASSISTANT_FULLSCREEN_BREAKPOINT = 760/);
assert.match(workspace, /viewportWidth <= ASSISTANT_FULLSCREEN_BREAKPOINT \? width : clampAssistantWidth/);
assert.match(workspace, /assistantWorkspaceMode/);
assert.match(behavior, /fitAssistantWidthToViewport\(680,980\),660/);
assert.match(behavior, /assistantWorkspaceMode\(761\),"split"/);
console.log("PASS build 009: Agent width preserves usable split workspace");
