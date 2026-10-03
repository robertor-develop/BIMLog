import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const source=readFileSync(fileURLToPath(new URL("./support-cases.ts",import.meta.url)),"utf8");
assert.match(source,/type:input\.assigned\?"assigned":"released"/);assert.match(source,/actorUserId:actorId/);assert.match(source,/if\(updated\)await tx\.insert\(supportCaseEventsTable\)/);assert.ok(source.indexOf("if(updated)await tx.insert(supportCaseEventsTable)")<source.indexOf('return updated??"stale"'));
console.log("B183 atomic support ownership history: PASS");
