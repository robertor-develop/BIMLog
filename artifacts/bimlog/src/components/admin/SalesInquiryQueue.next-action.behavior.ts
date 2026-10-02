import assert from "node:assert/strict";import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";
const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"SalesInquiryQueue.tsx"),"utf8");
assert.match(source,/Schedule next action/);assert.match(source,/Programar siguiente acción/);
assert.match(source,/\/next-action/);assert.match(source,/expectedUpdatedAt:selected\.updatedAt/);
assert.match(source,/selected\.assignedToCurrentUser&&selected\.status!=="closed"/);
assert.match(source,/Only the current owner can schedule/);assert.match(source,/Solo el responsable actual puede programar/);
assert.match(source,/type="datetime-local"/);assert.match(source,/nextActionType&&selected\.nextActionDueAt/);
console.log("B135 bilingual owned sales next-action workspace: PASS");
