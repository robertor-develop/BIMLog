import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync(new URL("./TotalControl.tsx",import.meta.url),"utf8");
assert.match(source,/import \{ SalesInquiryQueue \}/);assert.match(source,/"Sales Inquiries"/);assert.match(source,/"Consultas comerciales"/);assert.match(source,/activeTab === 6/);assert.match(source,/<SalesInquiryQueue token=\{token\}/);
console.log("B105 bilingual Total Control sales operations integration: PASS");
