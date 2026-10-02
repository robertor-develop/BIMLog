import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync(new URL("./SalesInquiryQueue.tsx",import.meta.url),"utf8");
assert.match(source,/parseSalesInquiryList/);assert.match(source,/params\.set\("status",status\)/);assert.match(source,/role="alert"/);assert.match(source,/overflowX:"auto"/);assert.match(source,/No inquiries match this status/);
assert.match(source,/role="dialog"/);assert.match(source,/aria-modal="true"/);assert.match(source,/whiteSpace:"pre-wrap"/);assert.match(source,/overflowWrap:"anywhere"/);
assert.match(source,/expectedStatus:selected\.status/);assert.match(source,/response\.status===409/);assert.match(source,/nextStatuses\[selected\.status\]/);assert.match(source,/disabled=\{updating\}/);
assert.match(source,/Consultas comerciales/);assert.match(source,/Ninguna consulta coincide/);assert.match(source,/width:"min\(680px,100%\)"/);
assert.match(source,/new URLSearchParams/);assert.match(source,/role="search"/);assert.match(source,/setOffset\(0\)/);assert.match(source,/aria-label="Sales inquiry pages"/);assert.match(source,/offset\+items\.length>=total/);
console.log("B108 searchable paged sales inquiry queue: PASS");
