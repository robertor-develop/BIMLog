import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const hex=(value,n)=>new RegExp(`^[a-f0-9]{${n}}$`).test(value||"");
export function validateCandidateIdentity(row){
  const errors=[];
  if(row?.schemaVersion!=="bimlog-web-candidate-identity-v1") errors.push("schema");
  if(!hex(row?.source?.head,40)||!hex(row?.source?.tree,40)) errors.push("source");
  if(row?.source?.clean!==true) errors.push("dirty");
  for(const key of ["packageJsonSha256","lockfileSha256","migrationSetSha256"]) if(!hex(row?.digests?.[key],64)) errors.push(key);
  if(!hex(row?.rollback?.sourceSha,40)) errors.push("rollback");
  if(!["PASS","FAIL","UNTESTED"].includes(row?.database?.preview)) errors.push("database-preview");
  if(row?.database?.preview!=="PASS") errors.push("release-blocked-database");
  if(row?.deployment?.identity!=="UNTESTED") errors.push("deployment-must-remain-untested-locally");
  return {valid:errors.length===0,errors};
}
export const shaFile=file=>createHash("sha256").update(readFileSync(file)).digest("hex");
