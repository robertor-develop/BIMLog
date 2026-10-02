import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync(new URL("./CommercialWorkspace.tsx",import.meta.url),"utf8");
for(const token of ["Billing & Support","Facturación y Soporte","/api/v1/commercial/workspace","Loading commercial status","Status unavailable","Action required","Complete these items before selling subscriptions"])assert.match(source,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
assert.match(source,/AbortController/);assert.match(source,/parseCommercialWorkspace/);assert.doesNotMatch(source,/stripe.*secret/i);
console.log("B069 bilingual Billing & Support workspace: PASS");
