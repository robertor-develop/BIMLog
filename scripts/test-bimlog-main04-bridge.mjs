import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bridge = readFileSync(new URL("./bimlog-main04-bridge.mjs", import.meta.url), "utf8");
const panel = readFileSync(new URL("../artifacts/bimlog/src/components/layout/PageAssistant.tsx", import.meta.url), "utf8");
const thread = "01a10a95-a2e5-73d3-a471-6738addc7e42";

assert.match(bridge, /let fifo = Promise\.resolve\(\)/, "bridge must serialize requests through one FIFO");
assert.match(bridge, /\["queue", "--thread", THREAD_ID, "--message", question\]/, "bridge must queue the exact prompt into MAIN 04");
assert.match(bridge, /item\.text === prompt/, "bridge must correlate the exact submitted prompt");
assert.match(bridge, /payload\.turn_id === turnId/, "bridge must return the answer from the matching turn");
assert.match(bridge, /access-control-allow-private-network/, "browser loopback preflight must be accepted");
assert.ok(bridge.includes(thread), "bridge must target the permanent BIMLog MAIN 04 thread");
assert.ok(panel.includes("http://127.0.0.1:8789/v1/questions"), "panel must call the BIMLog-owned loopback bridge");
assert.ok(panel.includes('data.transport!=="main04-local-fifo"'), "panel must reject another transport");
assert.ok(panel.includes(thread), "panel must verify the permanent MAIN 04 thread");
assert.doesNotMatch(panel, /\/assistant\/ask/, "question path must not use the hosted assistant route");
assert.doesNotMatch(bridge, /operations/i, "bridge must not depend on Operations");

console.log("BIMLog MAIN 04 Atlas-parity bridge contract: PASS");
