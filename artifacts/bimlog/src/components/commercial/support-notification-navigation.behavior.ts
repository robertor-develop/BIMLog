import assert from "node:assert/strict";import fs from "node:fs";const customer=fs.readFileSync(new URL("./SupportCasesPanel.tsx",import.meta.url),"utf8"),admin=fs.readFileSync(new URL("../admin/SupportCaseQueue.tsx",import.meta.url),"utf8");
for(const source of [customer,admin])assert.match(source,/URLSearchParams\(window\.location\.search\).*get\("supportCase"\).*Number\.isSafeInteger/s);
assert.match(customer,/openCase===item\.id.*SupportConversation/s);assert.match(admin,/openCase===item\.id.*SupportConversation/s);
console.log("B180 support notification destinations open the exact conversation: PASS");
