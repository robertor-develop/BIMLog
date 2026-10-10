import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./commercial-workspace-client.ts",import.meta.url),"utf8");
for(const token of ["CommercialCheckoutSummaryDto","latestCheckout","Invalid checkout completion evidence",'"creating","open","completed","expired","canceled","failed"'])assert.ok(source.includes(token),token);
assert.ok(!source.includes("providerSession"),"provider session identity must stay server-side");
console.log("LR053 checkout-summary browser contract acceptance: PASS");
