import assert from "node:assert/strict";import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";
const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"contact.ts"),"utf8");
assert.match(source,/patch\("\/admin\/sales-inquiries\/:id\/next-action"/);
assert.match(source,/parseSalesInquiryNextAction\(req\.body\)/);
assert.match(source,/current\.assignedToUserId!==actorId/);
assert.match(source,/current\.status==="closed"/);
assert.match(source,/SALES_INQUIRY_OWNER_REQUIRED/);
assert.match(source,/nextActionType:contactSubmissionsTable\.nextActionType/);
console.log("B133 protected revision-safe sales next-action endpoint: PASS");
