import crypto from "node:crypto";
export type HandoverPackageItem={requirementId:string;fileId:string;revisionId:string;approvalStatus:"approved"|"draft"|"rejected";sha256:string;fileName:string};
export function buildHandoverPackageManifest(input:{projectId:number;packageId:string;items:readonly HandoverPackageItem[];unresolvedExclusions:readonly {requirementId:string;reason:string}[]}){
  const keys=input.items.map(item=>`${item.fileId}:${item.revisionId}`);if(new Set(keys).size!==keys.length)throw new Error("Handover package contains duplicate file revisions.");if(input.items.some(item=>item.approvalStatus!=="approved"||!/^[a-f0-9]{64}$/i.test(item.sha256)))throw new Error("Handover package accepts only exact approved revisions with SHA-256.");
  const items=[...input.items].sort((a,b)=>a.requirementId.localeCompare(b.requirementId)||a.fileId.localeCompare(b.fileId));const exclusions=[...input.unresolvedExclusions].sort((a,b)=>a.requirementId.localeCompare(b.requirementId));const payload={schemaVersion:1,projectId:input.projectId,packageId:input.packageId,items:items.map(({approvalStatus,...item})=>item),unresolvedExclusions:exclusions,previewOnly:true,deliveryPerformed:false,hiddenDuplicates:0};
  return Object.freeze({...payload,manifestSha256:crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")});
}
