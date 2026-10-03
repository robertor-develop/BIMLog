import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const source=readFileSync(fileURLToPath(new URL("./support-cases.ts",import.meta.url)),"utf8");
assert.match(source,/type:"status_changed",actorUserId:req\.user!\.userId,fromValue:input\.expectedStatus,toValue:row\.status/);assert.ok(source.indexOf('type:"status_changed"')<source.indexOf('supportNotification("status_changed"'));
console.log("B184 atomic support lifecycle history: PASS");
