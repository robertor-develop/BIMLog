import assert from "node:assert/strict";
import {createLensNextApiClient} from "./lens-next-client";
import type {LensNextCreateDraft} from "./lens-next-types";
const draft={note:"Reviewed fixture",trade:"HVAC",floor:"1",reportType:"Coordination",priority:3,status:"open",responsibleCompany:"",openItems:""} as LensNextCreateDraft;
let posts=0,mode="saved";const identity={projectId:91,serverId:7,viewpointId:"stable-fixture",lifecycleStatus:"active",revisionNumber:1};
const api=createLensNextApiClient({token:"synthetic-session",fetchImpl:async(input,init)=>{const url=String(input);if(init?.method==="POST"){posts++;throw new Error("Fixture response lost after save");}if(url.includes("lens-pull"))return Response.json({success:true,viewpoints:[{id:7,projectId:mode==="foreign"?92:91,viewpointId:"stable-fixture",lifecycleStatus:"active",revisionNumber:1,displayId:"HV-001",visualStateAvailable:true,visualStateDigest:"b".repeat(64),...draft,note:mode==="changed"?"Other saved content":draft.note}]});return Response.json({success:true,identity,visualStateDigest:"b".repeat(64),visualStateJson:JSON.stringify({ModelFingerprint:(mode==="wrong-model"?"c":"a").repeat(64)})});}});
assert.equal((await api.createIssue(91,"stable-fixture","a".repeat(64),{},draft,"Reviewed reason")).serverId,7);assert.equal(posts,1);
for(const rejected of ["foreign","changed","wrong-model"]){mode=rejected;await assert.rejects(()=>api.createIssue(91,"stable-fixture","a".repeat(64),{},draft,"Reviewed reason"),/response lost/);}
console.log("Lens creation client runtime: lost saved response recovers exact project/content/model package; foreign project,changed content,wrong model rejected; no second POST during recovery PASS");
