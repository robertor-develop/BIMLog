import assert from "node:assert/strict";
import {executeLensNextCreation,type LensNextCreationAttempt} from "./lens-next-create-attempt";
import type {LensNextCreateDraft,LensNextCreateReceipt} from "./lens-next-types";
const input={projectId:91,modelFingerprint:"a".repeat(64),authorityKey:"synthetic-session",draft:{note:"Fixture",trade:"HVAC",floor:"1",reportType:"Coordination",priority:3,status:"open",responsibleCompany:"",openItems:""} as LensNextCreateDraft,reason:"Reviewed fixture creation"};
const holder:{current:LensNextCreationAttempt|null}={current:null};let captures=0,creates=0,reopens=0,refreshOkay=false,current=true,createFails=false;const identities:string[]=[];
const operations={newIdentity:()=>"stable-fixture-identity",isCurrent:()=>current,capture:async()=>{captures++;return{ContractVersion:"lens-next-navigation.v1"};},create:async(viewpointId:string)=>{creates++;identities.push(viewpointId);if(createFails)throw new Error("Lost response fixture");return{serverId:7,viewpointId,displayId:"HVAC-1-1",displayCode:"HVAC-1-1",visualStateDigest:"b".repeat(64),revisionNumber:1,lifecycleStatus:"active"} as LensNextCreateReceipt;},reopen:async()=>{reopens++;return refreshOkay;}};
await assert.rejects(()=>executeLensNextCreation(holder,input,operations),/was saved.*refreshed record/);assert.equal(creates,1);assert.equal(holder.current?.receipt?.serverId,7);
await assert.rejects(()=>executeLensNextCreation(holder,{...input,draft:{...input.draft,note:"Changed"}},operations),/previous creation outcome/);assert.equal(creates,1);
refreshOkay=true;const recovered=await executeLensNextCreation(holder,input,operations);assert.equal(recovered.serverId,7);assert.equal(captures,1);assert.equal(creates,1);assert.equal(reopens,2);assert.equal(holder.current,null);
createFails=true;await assert.rejects(()=>executeLensNextCreation(holder,input,operations),/Lost response/);const retained=(holder.current as LensNextCreationAttempt|null)!.viewpointId;const uncertainCreates=creates;await assert.rejects(()=>executeLensNextCreation(holder,{...input,draft:{...input.draft,note:"Changed while response unknown"}},operations),/previous creation outcome/);assert.equal(creates,uncertainCreates);createFails=false;await executeLensNextCreation(holder,input,operations);assert.equal(identities.at(-1),retained);assert.equal(captures,2);
current=false;const before=creates;await assert.rejects(()=>executeLensNextCreation(holder,input,operations),/Project or session changed/);assert.equal(creates,before);
console.log("Lens issue creation runtime: known saved receipt reopens without duplicate, changed pending draft denied, uncertain retry retains identity/capture, changed session stops before write PASS");

const captureFailureHolder:{current:LensNextCreationAttempt|null}={current:null};let safeCreates=0;
await assert.rejects(()=>executeLensNextCreation(captureFailureHolder,input,{...operations,capture:async()=>{throw Error("Capture failed before submission");},create:async()=>{safeCreates++;throw Error("must not submit");}}),/Capture failed before submission/);
assert.equal(safeCreates,0);assert.equal(captureFailureHolder.current,null,"Capture failure before submission must not lock a changed draft");
const changedDraft={...input,draft:{...input.draft,note:"Corrected after capture failure"}};
await executeLensNextCreation(captureFailureHolder,changedDraft,{...operations,isCurrent:()=>true,create:async viewpointId=>{safeCreates++;return{serverId:8,viewpointId} as LensNextCreateReceipt;},reopen:async()=>true});
assert.equal(safeCreates,1);assert.equal(captureFailureHolder.current,null);
const changedContextHolder:{current:LensNextCreationAttempt|null}={current:null};
await assert.rejects(()=>executeLensNextCreation(changedContextHolder,input,{...operations,isCurrent:()=>false}),/No creation was submitted/);assert.equal(changedContextHolder.current,null,"Context change before submission must release the unsent attempt");
console.log("Pre-submission capture/context failure releases only unsent attempts; edited retry succeeds without duplicate PASS");

const legacyUnknown:{current:LensNextCreationAttempt|null}={current:{fingerprint:JSON.stringify([input.projectId,input.modelFingerprint,input.authorityKey,input.draft,input.reason]),viewpointId:"legacy-unknown",navigation:{ContractVersion:"lens-next-navigation.v1"}}};
await assert.rejects(()=>executeLensNextCreation(legacyUnknown,input,{...operations,isCurrent:()=>false}),/previous creation outcome/);assert.equal(legacyUnknown.current?.viewpointId,"legacy-unknown");

let persisted:LensNextCreationAttempt|null=null;let durableCreates=0,durableCaptures=0,durableReopens=0;
const durableHolder={current:null as LensNextCreationAttempt|null,load:()=>persisted,save:(attempt:LensNextCreationAttempt|null)=>{persisted=attempt?JSON.parse(JSON.stringify(attempt)):null;}};
await assert.rejects(()=>executeLensNextCreation(durableHolder,input,{...operations,isCurrent:()=>true,capture:async()=>{durableCaptures++;return{ContractVersion:"lens-next-navigation.v1"};},create:async viewpointId=>{durableCreates++;return{serverId:1079,viewpointId,displayId:"EL-1079",displayCode:"EL-1079",visualStateDigest:"c".repeat(64),revisionNumber:1,lifecycleStatus:"active"};},reopen:async()=>{durableReopens++;return false;}}),/Issue #1079 was saved/);
assert.equal(durableCreates,1);assert.equal(persisted?.receipt?.serverId,1079);
const editedReloadHolder={...durableHolder,current:null as LensNextCreationAttempt|null};
await assert.rejects(()=>executeLensNextCreation(editedReloadHolder,{...input,draft:{...input.draft,instruction:"Edited after save"}},{...operations,isCurrent:()=>true,capture:async()=>{durableCaptures++;throw Error("edited recovery must not recapture");},create:async()=>{durableCreates++;throw Error("edited recovery must not create");}}),/previous creation outcome is pending/);
assert.equal(durableCreates,1);assert.equal(durableCaptures,1);assert.equal(persisted?.receipt?.serverId,1079);
const reloadedHolder={...durableHolder,current:null as LensNextCreationAttempt|null};
const reopened=await executeLensNextCreation(reloadedHolder,input,{...operations,isCurrent:()=>true,capture:async()=>{durableCaptures++;throw Error("saved receipt recovery must not recapture");},create:async()=>{durableCreates++;throw Error("saved receipt recovery must not create");},reopen:async receipt=>{durableReopens++;return receipt.serverId===1079;}});
assert.equal(reopened.serverId,1079);assert.equal(durableCreates,1);assert.equal(durableCaptures,1);assert.equal(durableReopens,2);assert.equal(persisted,null);
console.log("Durable saved receipt survives panel reload, reopens issue 1079 without recapture or duplicate creation PASS");
