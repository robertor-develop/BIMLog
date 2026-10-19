import assert from "node:assert/strict";
import {verifyReleaseIdentity} from "./lib/hosted-agent-live-acceptance.mjs";

const source="7".repeat(40),digest="c".repeat(64);
assert.deepEqual(verifyReleaseIdentity({status:"ok",sourceCommit:source,assetManifestSha256:digest,packageId:`bimlog-${source.slice(0,16)}-${digest.slice(0,16)}`,identityBound:true}),{pass:true,errors:[]});
for(const bad of [
  {status:"starting",sourceCommit:source,assetManifestSha256:digest,packageId:`bimlog-${source.slice(0,16)}`,identityBound:true},
  {status:"ok",sourceCommit:"latest",assetManifestSha256:digest,packageId:"bimlog-latest",identityBound:true},
  {status:"ok",sourceCommit:source,assetManifestSha256:digest,packageId:"bimlog-other",identityBound:true},
  {status:"ok",sourceCommit:source,assetManifestSha256:digest,packageId:`bimlog-${source.slice(0,16)}`,identityBound:false},
]) assert.equal(verifyReleaseIdentity(bad).pass,false);
console.log("CORRECTIVE-B31 hosted Agent release identity: PASS");
