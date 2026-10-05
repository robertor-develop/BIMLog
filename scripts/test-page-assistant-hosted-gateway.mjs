import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("artifacts/api-server/src/routes/agents.ts", "utf8");
assert.match(route, /resolveBimlogDedicatedAgent/);
assert.match(route, /getAnthropicClientForUser/);
assert.match(route, /requireProjectMember\(\)/);
assert.match(route, /parseAssistantAnswer/);
assert.match(route, /instructionDigest/);
assert.match(route, /agentVersion/);
assert.match(route, /transport: "hosted"/);
assert.doesNotMatch(route, /127\.0\.0\.1|localhost|desktop assistant/i);
console.log("PASS authenticated hosted BIMLog Agent Gateway");
