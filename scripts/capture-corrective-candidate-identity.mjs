import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { shaFile,validateCandidateIdentity } from "./lib/candidate-identity.mjs";
const git=(...args)=>{const r=spawnSync("git",args,{encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
const migrationFiles=git("ls-files").split(/\r?\n/).filter(p=>/(migration|schema)/i.test(p)&&/\.(ts|sql|mjs|json)$/.test(p)).sort();
const migrationHash=createHash("sha256");for(const file of migrationFiles){migrationHash.update(file);migrationHash.update(readFileSync(file));}
const requiredConfig=["BIMLOG_STRIPE_PRICE_IDS","BIMLOG_COMMERCIAL_MODE","STRIPE_SECRET_KEY","BIMLOG_APP_ORIGIN","STRIPE_WEBHOOK_SECRET","STRIPE_PORTAL_CONFIGURATION_ID","SENDGRID_API_KEY","BIMLOG_SUPPORT_FROM_EMAIL","BIMLOG_SUPPORT_INBOX_EMAIL"];
const output=process.argv[2];if(!output)throw new Error("output path required");
const status=git("status","--porcelain");if(status)throw new Error(`candidate worktree is dirty:\n${status}`);
const receipt={schemaVersion:"bimlog-web-candidate-identity-v1",capturedAt:new Date().toISOString(),source:{head:git("rev-parse","HEAD"),tree:git("rev-parse","HEAD^{tree}"),branch:git("branch","--show-current"),clean:true},digests:{packageJsonSha256:shaFile("package.json"),lockfileSha256:shaFile("pnpm-lock.yaml"),migrationSetSha256:migrationHash.digest("hex")},configuration:{required:requiredConfig.map(name=>({name,present:Boolean(process.env[name])})),valuesCaptured:false},database:{preview:"UNTESTED",schemaReceipt:null,migrationReceipt:null},rollback:{sourceSha:git("rev-parse","@{upstream}"),databaseReceipt:null},deployment:{identity:"UNTESTED",deploymentId:null}};
const validation=validateCandidateIdentity(receipt);receipt.releaseEligible=validation.valid;receipt.blockers=validation.errors;
writeFileSync(output,JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({output,head:receipt.source.head,clean:true,releaseEligible:receipt.releaseEligible,blockers:receipt.blockers}));
