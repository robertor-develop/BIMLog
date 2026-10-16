import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
export function verifyIndependentEvidence(packet,{root=process.cwd()}={}){
  const errors=[];
  if(packet?.schemaVersion!=="bimlog-independent-evidence-v1") errors.push("schema");
  if(!/^[a-f0-9]{40}$/.test(packet?.sourceSha||"")) errors.push("sourceSha");
  if(!Array.isArray(packet?.observations)||packet.observations.length===0) errors.push("observations");
  for(const [index,row] of (packet?.observations||[]).entries()){
    if(!["PASS","FAIL","UNTESTED"].includes(row.result)) errors.push(`observation:${index}:result`);
    if(row.result==="PASS"){
      if(!row.artifact||!/^[a-f0-9]{64}$/.test(row.sha256||"")) errors.push(`observation:${index}:artifact`);
      else {
        const file=resolve(root,row.artifact);
        if(!existsSync(file)) errors.push(`observation:${index}:missing`);
        else if(sha256(readFileSync(file))!==row.sha256) errors.push(`observation:${index}:digest`);
      }
    }
  }
  if(packet?.claims?.some?.(claim=>claim.result==="PASS"&&!packet.observations?.some?.(row=>row.claimId===claim.id&&row.result==="PASS"))) errors.push("unbacked-pass-claim");
  return {valid:errors.length===0,errors};
}
