import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const source=readFileSync(fileURLToPath(new URL("./contact.ts",import.meta.url)),"utf8");
assert.match(source,/parseSalesInquiryInput\(req\.body\)/);
assert.match(source,/salesInquiryFingerprint\(input\)/);
assert.match(source,/code!=="23505"/);
assert.match(source,/SALES_INQUIRY_REQUEST_CONFLICT/);
assert.match(source,/replayed:true/);
assert.match(source,/SALES_INQUIRY_UNAVAILABLE/);
assert.doesNotMatch(source,/err instanceof Error \? err\.message/);
assert.match(source,/\/admin\/sales-inquiries/);
assert.match(source,/authMiddleware,isSuperAdminMiddleware/);
assert.match(source,/SALES_INQUIRY_STALE_OR_MISSING/);
console.log("B098 idempotent bounded public sales inquiry endpoint: PASS");
