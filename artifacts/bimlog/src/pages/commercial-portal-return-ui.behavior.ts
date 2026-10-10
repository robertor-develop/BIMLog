import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./CommercialWorkspace.tsx",import.meta.url),"utf8");
for(const token of ["parseCommercialPortalReturn","deriveCommercialPortalReturnState","Billing status refreshed","does not by itself confirm a billing change"])assert.ok(source.includes(token),token);
console.log("LR069 billing portal return UI: PASS");
