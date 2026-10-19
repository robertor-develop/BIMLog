import assert from "node:assert/strict";
import {verifyAuthenticatedScope} from "./lib/hosted-agent-live-acceptance.mjs";

const valid={authenticated:true,userId:17,tenantId:4,requestedTenantId:4,answeredTenantId:4,projectId:521,requestedProjectId:521,answeredProjectId:521,membershipAuthorized:true,crossTenantAccessDenied:true};
assert.deepEqual(verifyAuthenticatedScope(valid),{pass:true,errors:[]});
for(const patch of [
  {authenticated:false},
  {userId:0},
  {membershipAuthorized:false},
  {answeredTenantId:8},
  {answeredProjectId:522},
  {crossTenantAccessDenied:false},
]) assert.equal(verifyAuthenticatedScope({...valid,...patch}).pass,false);
const headquarters={...valid,projectId:null,requestedProjectId:null,answeredProjectId:null};
assert.equal(verifyAuthenticatedScope(headquarters).pass,true);
console.log("CORRECTIVE-B33 hosted Agent authenticated scope: PASS");
