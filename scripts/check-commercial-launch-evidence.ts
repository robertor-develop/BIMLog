import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";import {commercialVerificationEvidenceIsCurrent,type CommercialLaunchVerificationEvidence} from "../artifacts/api-server/src/lib/commercial-launch-verification-evidence";
const SHA40=/^[0-9a-f]{40}$/;
export function checkCommercialLaunchEvidence(value:unknown,expectedSource:string,now=new Date()){
  if(!value||typeof value!=="object"||!SHA40.test(expectedSource))return Object.freeze({accepted:false,code:"evidence_invalid" as const});
  const item=value as Partial<CommercialLaunchVerificationEvidence>;
  if(item.schemaVersion!=="bimlog-commercial-verification-v1"||item.sourceCommit!==expectedSource||item.status!=="verified"||item.verified!==true||typeof item.checkedAt!=="string"||typeof item.validUntil!=="string"||typeof item.checkCount!=="number"||!Array.isArray(item.failedCheckIds)||item.failedCheckIds.length||typeof item.evidenceSha256!=="string"||!/^[0-9a-f]{64}$/.test(item.evidenceSha256))return Object.freeze({accepted:false,code:"evidence_invalid" as const});
  if(!commercialVerificationEvidenceIsCurrent(item as CommercialLaunchVerificationEvidence,now))return Object.freeze({accepted:false,code:"evidence_expired" as const});
  return Object.freeze({accepted:true,code:"evidence_current" as const,sourceCommit:item.sourceCommit,validUntil:item.validUntil,evidenceSha256:item.evidenceSha256});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const receiptArg=process.argv.indexOf("--receipt"),sourceArg=process.argv.indexOf("--source");if(receiptArg<0||sourceArg<0)throw new Error("Use --receipt <path> --source <40-char commit>");const result=checkCommercialLaunchEvidence(JSON.parse(fs.readFileSync(path.resolve(process.argv[receiptArg+1]),"utf8")),process.argv[sourceArg+1]);process.stdout.write(`${JSON.stringify(result,null,2)}\n`);if(!result.accepted)process.exitCode=1;}
