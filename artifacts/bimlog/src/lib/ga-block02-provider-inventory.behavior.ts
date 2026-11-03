import assert from "node:assert/strict";
import { providerConnectionTruth } from "./provider-connection-truth";
for(const key of ["procore","sharepoint","outlook","google-drive","dropbox","ifc","bimlog-files"])assert.equal(providerConnectionTruth({key,availability:"available",connected:false}).state,"setup_required");
assert.equal(providerConnectionTruth({key:"procore",availability:"available",connected:true,lastError:"TOKEN_EXPIRED"}).state,"recovery_required");
assert.deepEqual(providerConnectionTruth({key:"sharepoint",availability:"available",connected:true,lastSuccessfulOperationAt:"2026-10-20T00:00:00Z"}),{state:"ready",nextAction:"Use integration"});
console.log("GA Block 2 Build 9 unified provider inventory: PASS");

assert.deepEqual(providerConnectionTruth({key:"procore",availability:"setup_required",permissionState:"approved",connected:false}),{state:"application_setup_required",nextAction:"Restore Procore application setup"});
