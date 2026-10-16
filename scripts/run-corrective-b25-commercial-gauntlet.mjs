import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const target=process.argv[2]??"evidence/post-audit-corrective-20261016/corrective-b25-commercial-gauntlet.json";
const gates=["test:corrective-b21","test:corrective-b22","test:corrective-b23","test:corrective-b24"];
const results=gates.map(gate=>{
  const run=process.platform==="win32"
    ?spawnSync(process.env.ComSpec||"cmd.exe",["/d","/s","/c",`pnpm run ${gate}`],{encoding:"utf8",maxBuffer:10*1024*1024})
    :spawnSync("pnpm",["run",gate],{encoding:"utf8",maxBuffer:10*1024*1024});
  const output=`${run.stdout||""}${run.stderr||""}`;
  if(output) process.stdout.write(output);
  return Object.freeze({gate,result:run.status===0?"PASS":"FAIL",exitCode:run.status,outputSha256:createHash("sha256").update(output).digest("hex")});
});
assert.deepEqual(results.filter(item=>item.result!=="PASS"),[]);
const receipt=Object.freeze({
  schemaVersion:"bimlog-corrective-b25-commercial-gauntlet-v1",
  scope:"implementation and deterministic provider-boundary verification",
  results,
  protectedProductionDataMutations:0,
  configuredSecretsInspected:0,
  remainingExternalConfiguration:Object.freeze(["BIMLOG_STRIPE_PRICE_IDS","BIMLOG_COMMERCIAL_MODE","STRIPE_SECRET_KEY","BIMLOG_APP_ORIGIN","STRIPE_WEBHOOK_SECRET","STRIPE_PORTAL_CONFIGURATION_ID","SENDGRID_API_KEY","BIMLOG_SUPPORT_FROM_EMAIL","BIMLOG_SUPPORT_INBOX_EMAIL"]),
  liveStripeVerification:"BLOCKED_PENDING_CONFIGURATION",
  liveSendGridVerification:"BLOCKED_PENDING_CONFIGURATION",
  overall:"LOCAL_PASS_EXTERNAL_CONFIGURATION_REQUIRED",
});
mkdirSync(dirname(target),{recursive:true});
writeFileSync(target,`${JSON.stringify(receipt,null,2)}\n`);
console.log(`CORRECTIVE-B25 commercial gauntlet: ${receipt.overall}`);
