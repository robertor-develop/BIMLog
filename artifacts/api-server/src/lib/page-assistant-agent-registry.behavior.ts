import assert from "node:assert/strict";
import { resolveBimlogDedicatedAgent } from "./page-assistant-agent-registry";

const agent = resolveBimlogDedicatedAgent();
assert.equal(agent.key, "bimlog");
assert.equal(agent.agentId, "bimlog-dedicated-agent");
assert.equal(agent.provider, "anthropic");
assert.match(agent.instructionDigest, /^[0-9a-f]{64}$/);
assert.match(agent.instructions, /actual term or question directly/);
assert.match(agent.instructions, /Never mention localhost/);
assert.notEqual(agent.agentId, agent.model);
console.log("PASS BIMLog hosted dedicated-agent registry");
