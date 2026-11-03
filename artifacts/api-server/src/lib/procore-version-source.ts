import {createHash} from "node:crypto";
import {getValidAccessToken} from "./oauth";
import {downloadProcoreFileBytes} from "./procore-file-download";

type ExactSourceSelection={companyId:string;ref:string;versionId:string;name:string};
/** Exact project document/version lookup; never substitute the latest version.
 * https://developers.procore.com/reference/rest/project-folders-and-files?version=1.0
 */
export async function downloadExactProcoreSource(userId:number, selected:ExactSourceSelection, dependencies:{token?:typeof getValidAccessToken;fetch?:typeof fetch}={}) {
 const ref=/^file:([1-9]\d*):([1-9]\d*)$/.exec(selected.ref);
 if(!ref||!/^([1-9]\d*)$/.test(selected.companyId)||!/^([1-9]\d*)$/.test(selected.versionId)||!selected.name.trim())throw Error("PROCORE_EXACT_SELECTION_INVALID");
 const [,projectId,fileId]=ref;
 const token=await (dependencies.token??getValidAccessToken)(userId,"procore");
 const request=dependencies.fetch??fetch;
 const metadata=async(path:string)=>{
  const response=await request(`https://api.procore.com/rest/v1.0/${path}?project_id=${projectId}`,{redirect:"error",signal:AbortSignal.timeout(30_000),headers:{Authorization:`Bearer ${token}`,"Procore-Company-Id":selected.companyId}});
  if(!response.ok)throw Error(`PROCORE_SOURCE_HTTP_${response.status}`);
  const body:unknown=await response.json();
  if(!body||typeof body!=="object"||Array.isArray(body))throw Error("PROCORE_SOURCE_METADATA_INVALID");
  return body as Record<string,unknown>;
 };
 const file=await metadata(`files/${fileId}`);
 if(String(file.id)!==fileId||String(file.project_id)!==projectId||file.name!==selected.name)throw Error("PROCORE_SOURCE_CHANGED");
 if(!Array.isArray(file.file_versions)||!file.file_versions.some((v:any)=>String(v?.id)===selected.versionId))throw Error("PROCORE_VERSION_UNAVAILABLE");
 const version=await metadata(`file_versions/${selected.versionId}`);
 if(String(version.id)!==selected.versionId||String(version.file_id)!==fileId||(version.project_id!=null&&String(version.project_id)!==projectId))throw Error("PROCORE_VERSION_IDENTITY_MISMATCH");
 const url=typeof version.url==="string"?version.url:"";
 if(!url)throw Error("PROCORE_VERSION_DOWNLOAD_UNAVAILABLE");
 const buffer=await downloadProcoreFileBytes(url,token,request);
 if(typeof version.size==="number"&&version.size!==buffer.length)throw Error("PROCORE_VERSION_SIZE_MISMATCH");
 return {buffer,ref:selected.ref,sourceCompanyId:selected.companyId,sourceProjectId:projectId,fileId,versionId:selected.versionId,name:selected.name,mimeType:typeof file.mime_type==="string"?file.mime_type:"application/octet-stream",size:buffer.length,sha256:createHash("sha256").update(buffer).digest("hex")};
}
