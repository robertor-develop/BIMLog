import assert from "node:assert/strict";
import {executeLensNextUpload,type LensNextUploadAttempt} from "./lens-next-upload-attempt";
const holder:{current:LensNextUploadAttempt|null}={current:null};let uploads=0,reopens=0,verified=false,current=true;const receipt={serverId:7,viewpointId:"fixture",navisworksGuid:"fixture-guid",visualStateDigest:"a".repeat(64)};
const operations={isCurrent:()=>current,upload:async()=>{uploads++;return receipt;},reopen:async()=>{reopens++;return verified;}};
await assert.rejects(()=>executeLensNextUpload(holder,"project91-model-a-guid1",operations),/was saved.*could not be reopened/);assert.equal(uploads,1);assert.equal(holder.current?.receipt?.serverId,7);
await assert.rejects(()=>executeLensNextUpload(holder,"project92-model-b-guid2",operations),/prior local upload/);assert.equal(uploads,1);
verified=true;assert.equal((await executeLensNextUpload(holder,"project91-model-a-guid1",operations)).serverId,7);assert.equal(uploads,1);assert.equal(reopens,2);assert.equal(holder.current,null);
current=false;await assert.rejects(()=>executeLensNextUpload(holder,"other",operations),/context changed/);assert.equal(uploads,1);
console.log("Lens local upload runtime: saved receipt retained after failed reopen,retry does not upload twice,different pending identity refused,changed context stops mutation PASS");
