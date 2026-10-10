import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./commercial-workspace.ts",import.meta.url),"utf8");
const workspaceStart=["router",".get(",'"/commercial/workspace"'].join("");
const checkoutStart=["router",".post(",'"/commercial/checkout"'].join("");
const workspace=source.slice(source.indexOf(workspaceStart),source.indexOf(checkoutStart));
for(const token of ["readLatestPersistentCheckout(pool,company.id)","Promise.all","latestCheckout","private, no-store"]){assert.ok(workspace.includes(token),token);}
assert.ok(!workspace.includes("provider_session_reference"),"provider session references must not enter the browser contract");
console.log("LR052 tenant-scoped checkout summary route acceptance: PASS");
