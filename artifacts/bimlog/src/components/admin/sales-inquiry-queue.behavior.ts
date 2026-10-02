import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync(new URL("./SalesInquiryQueue.tsx",import.meta.url),"utf8");
assert.match(source,/parseSalesInquiryList/);assert.match(source,/status=\$\{status\}/);assert.match(source,/role="alert"/);assert.match(source,/overflowX:"auto"/);assert.match(source,/No inquiries match this status/);
assert.match(source,/role="dialog"/);assert.match(source,/aria-modal="true"/);assert.match(source,/whiteSpace:"pre-wrap"/);assert.match(source,/overflowWrap:"anywhere"/);
console.log("B102 visible filterable sales inquiry queue: PASS");
