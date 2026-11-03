import assert from "node:assert/strict";
import {createLensNextApiClient} from "./lens-next-client";
import type {LensNextLocalViewpoint} from "./lens-next-types";
const local={projectId:91,serverId:null,exactManagedIdentity:true,viewpointId:"stable-fixture",navisworksGuid:"123e4567-e89b-42d3-a456-426614174000"} as LensNextLocalViewpoint;
let posts=0,mode="saved";const identity={projectId:91,serverId:7,viewpointId:local.viewpointId,lifecycleStatus:"active",revisionNumber:1};
const api=createLensNextApiClient({token:"synthetic-session",fetchImpl:async(input,init)=>{if(init?.method==="POST"){posts++;throw new Error("Fixture upload response lost");}if(String(input).includes("lens-pull"))return Response.json({success:true,viewpoints:[{id:7,projectId:mode==="foreign"?92:91,viewpointId:local.viewpointId,navisworksGuid:mode==="wrong-guid"?"other-guid":local.navisworksGuid,lifecycleStatus:"active",revisionNumber:1,displayId:"HV-001",visualStateAvailable:true,visualStateDigest:"b".repeat(64),status:"open",priority:3}]});return Response.json({success:true,identity,visualStateDigest:"b".repeat(64),visualStateJson:JSON.stringify({ModelFingerprint:(mode==="wrong-model"?"c":"a").repeat(64)})});}});
assert.equal((await api.uploadLocalViewpoint(local,"a".repeat(64),{},"Reviewed reason")).serverId,7);assert.equal(posts,1);
for(const rejected of ["foreign","wrong-guid","wrong-model"]){mode=rejected;await assert.rejects(()=>api.uploadLocalViewpoint(local,"a".repeat(64),{},"Reviewed reason"),/response lost/);}
console.log("Lens local upload client: lost response recovers exact project/GUID/model package;foreign project,wrong GUID,wrong model rejected;recovery never writes again PASS");
