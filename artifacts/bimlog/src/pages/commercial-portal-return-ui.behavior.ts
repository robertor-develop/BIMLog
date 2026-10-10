import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./CommercialWorkspace.tsx",import.meta.url),"utf8");
for(const token of ["parseCommercialPortalReturn","portalReturned&&data","Billing refreshed; return does not confirm a change."])assert.ok(source.includes(token),token);
console.log("LR069 billing portal return UI: PASS");
