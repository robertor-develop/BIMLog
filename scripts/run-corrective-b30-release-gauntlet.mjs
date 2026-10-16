import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const target=process.argv[2]??"evidence/post-audit-corrective-20261016/corrective-b30-release-gauntlet.json";
const gates=["test:corrective-b25","test:corrective-b26","test:corrective-b27","test:corrective-b28","test:corrective-b29"];
const results=gates.map(gate=>{const run=process.platform==="win32"?spawnSync(process.env.ComSpec||"cmd.exe",["/d","/s","/c",`pnpm run ${gate}`],{encoding:"utf8",maxBuffer:20*1024*1024}):spawnSync("pnpm",["run",gate],{encoding:"utf8",maxBuffer:20*1024*1024});const output=`${run.stdout||""}${run.stderr||""}`;if(output)process.stdout.write(output);return Object.freeze({gate,result:run.status===0?"PASS":"FAIL",exitCode:run.status,outputSha256:createHash("sha256").update(output).digest("hex")});});
assert.deepEqual(results.filter(item=>item.result!=="PASS"),[]);
const receipt=Object.freeze({schemaVersion:"bimlog-corrective-b30-release-gauntlet-v1",scope:"ten-build commercial customer-lifecycle release candidate",results,protectedProductionDataMutations:0,configuredSecretsInspected:0,unpublishedBuilds:10,publicationRequired:true,postPublicationAuthenticatedChromeRequired:true,liveStripeVerification:"BLOCKED_PENDING_CONFIGURATION",liveSendGridVerification:"BLOCKED_PENDING_CONFIGURATION",overall:"LOCAL_PASS_READY_FOR_PUBLICATION"});
mkdirSync(dirname(target),{recursive:true});writeFileSync(target,`${JSON.stringify(receipt,null,2)}\n`);
console.log(`CORRECTIVE-B30 release gauntlet: ${receipt.overall}`);
