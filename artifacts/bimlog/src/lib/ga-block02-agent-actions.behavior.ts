import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../components/layout/PageAssistant.tsx",import.meta.url),"utf8");
assert.match(source,/Ask a question/);
assert.doesNotMatch(source,/Submit feedback|Request a fix|page-assistant-coming-soon/);
assert.match(source,/Conversation tools/);
console.log("GA Block 2 Build 10 agent action lanes: PASS unavailable lanes removed");
