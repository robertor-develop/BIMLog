import type {Router,Request,Response} from "express";
import {createHash} from "node:crypto";
import {pool} from "@workspace/db";
import {authMiddleware,requireProjectMember,requirePermission} from "../middlewares/auth";
import {isProviderOperationCurrentlyAllowed} from "../lib/provider-governance";
import {downloadExactProcoreSource} from "../lib/procore-version-source";
import {inspectProjectFileUpload,ProjectFileUploadError} from "../lib/project-file-upload-contract";
import {storage,type StorageAdapter} from "../lib/storage-adapter";
import {getDefaultValue} from "../middlewares/config-validator";

type Input={requestId:string;sourceCompanyId:string;ref:string;versionId:string;sourceName:string;fileName:string;relationship:"created"|"modified"|"reference"|"supporting";expectedSha256?:string;confirmed?:boolean};
type Receipt={schema:"procore-document-import-v1";requestId:string;requestDigest:string;projectId:number;companyId:number;userId:number;fileId:number;fileName:string;sourceCompanyId:string;sourceRef:string;sourceVersionId:string;sourceSha256:string;relationship:string;reused:boolean;recordUrl:string;downloadUrl:string;createdAt:string};
type Hooks={validateName:(projectId:number,name:string)=>Promise<{valid:boolean;details?:unknown[]}>;fileTypeTier:(name:string)=>string;baseName:(name:string)=>string;processFile:(id:number,path:string,name:string,projectId:number,userId:number)=>Promise<void>;download?:typeof downloadExactProcoreSource;storage?:Pick<StorageAdapter,"upload"|"delete">};
type ImportClient={query(text:string,values?:unknown[]):Promise<{rows:any[]}>;release():void};
type FileFamily={id:number;file_name:string;version:number;parent_file_id:number|null};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ImportError extends Error{constructor(public status:number,public code:string,public details?:unknown){super(code);}}
function input(raw:any,commit=false):Input{
 if(!raw||!UUID.test(raw.requestId)||typeof raw.sourceCompanyId!=="string"||!/^([1-9]\d*)$/.test(raw.sourceCompanyId)||typeof raw.ref!=="string"||!/^file:[1-9]\d*:[1-9]\d*$/.test(raw.ref)||typeof raw.versionId!=="string"||!/^([1-9]\d*)$/.test(raw.versionId)||typeof raw.sourceName!=="string"||raw.sourceName.length<1||raw.sourceName.length>500||typeof raw.fileName!=="string"||raw.fileName.length<1||raw.fileName.length>500||!["created","modified","reference","supporting"].includes(raw.relationship))throw new ImportError(400,"PROCORE_IMPORT_INPUT_INVALID");
 if(commit&&(raw.confirmed!==true||typeof raw.expectedSha256!=="string"||!/^[a-f0-9]{64}$/.test(raw.expectedSha256)))throw new ImportError(400,"PROCORE_IMPORT_REVIEW_REQUIRED");
 return {requestId:raw.requestId,sourceCompanyId:raw.sourceCompanyId,ref:raw.ref,versionId:raw.versionId,sourceName:raw.sourceName,fileName:raw.fileName,relationship:raw.relationship,expectedSha256:raw.expectedSha256,confirmed:raw.confirmed};
}
function digest(v:Input,projectId:number,companyId:number,userId:number){return createHash("sha256").update(JSON.stringify({projectId,companyId,userId,sourceCompanyId:v.sourceCompanyId,ref:v.ref,versionId:v.versionId,sourceName:v.sourceName,fileName:v.fileName,relationship:v.relationship,expectedSha256:v.expectedSha256})).digest("hex");}
async function allowed(client:any,req:Request,projectId:number,write=false){
 const result=await client.query(`SELECT (actor.is_super_admin OR (actor.company_id=COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active' AND (NOT $4 OR EXISTS(SELECT 1 FROM config_options role WHERE role.category='member_role' AND role.value=pm.role AND role.meta->>'permission' IN('admin','write')))))) AS allowed FROM projects p JOIN users creator ON creator.id=p.created_by_id JOIN users actor ON actor.id=$1 JOIN companies co ON co.id=actor.company_id WHERE p.id=$2 AND p.status<>'archived' AND co.retired_at IS NULL AND co.retired_into_company_id IS NULL AND actor.company_id=$3`,[req.user!.userId,projectId,req.user!.companyId,write]);
 if(result.rows[0]?.allowed!==true)throw new ImportError(403,"CURRENT_PROJECT_COMPANY_REQUIRED");
}
async function saved(client:any,req:Request,projectId:number,requestId:string):Promise<Receipt|null>{
 const result=await client.query("SELECT details FROM activity_log WHERE project_id=$1 AND user_id=$2 AND action_type='procore_document_import' AND details LIKE $3 ORDER BY id DESC LIMIT 2",[projectId,req.user!.userId,`%\"requestId\":\"${requestId}\"%`]);
 if(!result.rows.length)return null;
 const receipt=JSON.parse(result.rows[0].details) as Receipt;
 if(receipt.schema!=="procore-document-import-v1"||receipt.requestId!==requestId||receipt.projectId!==projectId||receipt.companyId!==req.user!.companyId||receipt.userId!==req.user!.userId)throw new ImportError(409,"PROCORE_IMPORT_RECEIPT_MISMATCH");
 return receipt;
}
function failed(res:Response,error:unknown){
 if(error instanceof ImportError)return res.status(error.status).json({code:error.code,details:error.details});
 if(error instanceof ProjectFileUploadError)return res.status(error.status).json({code:error.code});
 console.error(JSON.stringify({event:"procore_document_import_failure",code:(error as any)?.code??(error as any)?.name??"UNKNOWN",table:(error as any)?.table,column:(error as any)?.column,constraint:(error as any)?.constraint}));
 const code=error instanceof Error?error.message:"PROCORE_IMPORT_UNAVAILABLE";
 if(["STORAGE_OBJECT_TOO_LARGE","STORAGE_MAX_BYTES_EXCEEDS_BACKEND_LIMIT"].includes(String((error as any)?.code??code)))return res.status(413).json({code:"PROCORE_IMPORT_STORAGE_LIMIT"});
 const known=/^(PROCORE_|not_connected|refresh_failed)/.test(code);
 return res.status(code==="not_connected"||code==="refresh_failed"||code==="PROCORE_SOURCE_HTTP_401"||code==="PROCORE_DOWNLOAD_HTTP_401"?428:code==="PROCORE_SOURCE_HTTP_403"||code==="PROCORE_DOWNLOAD_HTTP_403"?403:known?409:503).json({code:known?code:"PROCORE_IMPORT_UNAVAILABLE"});
}
export function registerProcoreDocumentImportRoutes(router:Router,hooks:Hooks){
 const download=hooks.download??downloadExactProcoreSource,store=hooks.storage??storage;
 const headers=(res:Response,req:Request,projectId:number)=>res.set({"Cache-Control":"private, no-store","X-BIMLog-Project-Id":String(projectId),"X-BIMLog-Caller-Id":String(req.user!.userId),"X-BIMLog-Company-Id":String(req.user!.companyId)});
 const project=(req:Request)=>{const id=Number(req.params.projectId);if(!Number.isSafeInteger(id)||id<=0)throw new ImportError(400,"PROJECT_ID_INVALID");return id;};
 router.post("/projects/:projectId/files/procore/preview",authMiddleware,requireProjectMember(),async(req,res)=>{
  try{
   const projectId=project(req),v=input(req.body);await allowed(pool,req,projectId);
   if(!await isProviderOperationCurrentlyAllowed("procore",req.user!.companyId,"browse"))throw new ImportError(403,"PROVIDER_NOT_APPROVED");
   const validation=await hooks.validateName(projectId,v.fileName);if(!validation.valid)throw new ImportError(422,"PROCORE_IMPORT_NAMING_REJECTED",validation.details);
   const source=await download(req.user!.userId,{companyId:v.sourceCompanyId,ref:v.ref,versionId:v.versionId,name:v.sourceName});
   inspectProjectFileUpload({fileName:v.fileName,mediaType:source.mimeType,bytes:source.buffer});
   headers(res,req,projectId).json({preview:{requestId:v.requestId,projectId,sourceCompanyId:v.sourceCompanyId,sourceRef:v.ref,sourceVersionId:v.versionId,sourceName:v.sourceName,fileName:v.fileName,relationship:v.relationship,sha256:source.sha256,size:source.size,confirmationRequired:true,canonicalMutation:false}});
  }catch(error){failed(res,error);}
 });
 router.get("/projects/:projectId/files/procore/receipts/:requestId",authMiddleware,requireProjectMember(),async(req,res)=>{
  try{const projectId=project(req),requestId=String(req.params.requestId);if(!UUID.test(requestId))throw new ImportError(400,"REQUEST_ID_INVALID");await allowed(pool,req,projectId);const receipt=await saved(pool,req,projectId,requestId);if(!receipt)throw new ImportError(404,"PROCORE_IMPORT_RECEIPT_NOT_FOUND");headers(res,req,projectId).json({receipt});}catch(error){failed(res,error);}
 });
 router.post("/projects/:projectId/files/procore/import",authMiddleware,requirePermission("admin","write"),async(req,res)=>{
  let pendingPath:string|null=null;let client:ImportClient|null=null;
  try{
   const projectId=project(req),v=input(req.body,true),requestDigest=digest(v,projectId,req.user!.companyId,req.user!.userId);
   client=await pool.connect();await client.query("BEGIN");await client.query("SET LOCAL lock_timeout=35000");
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`procore-import:${projectId}:${req.user!.userId}:${v.requestId}`]);
   await allowed(client,req,projectId,true);
   const prior=await saved(client,req,projectId,v.requestId);
   if(prior){if(prior.requestDigest!==requestDigest)throw new ImportError(409,"PROCORE_IMPORT_REQUEST_CHANGED");await client.query("COMMIT");headers(res,req,projectId).json({receipt:prior,replayed:true});return;}
   if(!await isProviderOperationCurrentlyAllowed("procore",req.user!.companyId,"import",client))throw new ImportError(403,"PROVIDER_NOT_APPROVED");
   const validation=await hooks.validateName(projectId,v.fileName);if(!validation.valid)throw new ImportError(422,"PROCORE_IMPORT_NAMING_REJECTED",validation.details);
   const source=await download(req.user!.userId,{companyId:v.sourceCompanyId,ref:v.ref,versionId:v.versionId,name:v.sourceName});
   if(source.sha256!==v.expectedSha256)throw new ImportError(409,"PROCORE_IMPORT_REVIEW_CHANGED");
   inspectProjectFileUpload({fileName:v.fileName,mediaType:source.mimeType,bytes:source.buffer});
   await allowed(client,req,projectId,true);
   if(!await isProviderOperationCurrentlyAllowed("procore",req.user!.companyId,"import",client))throw new ImportError(403,"PROVIDER_NOT_APPROVED");
   const currentNaming=await hooks.validateName(projectId,v.fileName);if(!currentNaming.valid)throw new ImportError(422,"PROCORE_IMPORT_NAMING_REJECTED",currentNaming.details);
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`procore-import-files:${projectId}`]);
   const duplicate=await client.query("SELECT id,file_name,document_relationship FROM files WHERE project_id=$1 AND file_hash=$2 ORDER BY id LIMIT 1",[projectId,source.sha256]);
   let fileId:number;let reused=false;let recordName=v.fileName;
   if(duplicate.rows[0]){if(duplicate.rows[0].file_name!==v.fileName||duplicate.rows[0].document_relationship!==v.relationship)throw new ImportError(409,"PROCORE_IMPORT_DUPLICATE_REVIEW_REQUIRED",{fileId:Number(duplicate.rows[0].id),fileName:duplicate.rows[0].file_name,recordUrl:`/projects/${projectId}/files`});fileId=Number(duplicate.rows[0].id);recordName=duplicate.rows[0].file_name;reused=true;}
   else{
    const family=((await client.query("SELECT id,file_name,version,parent_file_id FROM files WHERE project_id=$1 FOR UPDATE",[projectId])).rows as FileFamily[]).filter(row=>hooks.baseName(row.file_name)===hooks.baseName(v.fileName));
    const root=family.find(row=>row.parent_file_id===null)??family[0],version=family.length?Math.max(...family.map(row=>Number(row.version)))+1:1;
    let status:string;try{status=await getDefaultValue("file_status");}catch{throw new ImportError(503,"PROCORE_IMPORT_FILE_STATUS_REQUIRED");}pendingPath=await store.upload(source.buffer,projectId,v.fileName);
    const created=await client.query(`INSERT INTO files(project_id,file_name,file_size,file_type,version,parent_file_id,status,is_compliant,uploaded_by_id,file_hash,file_size_bytes,document_relationship,document_relationship_declared_at,file_type_tier,source,storage_path,file_metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$3,$11,now(),$12,'procore',$13,$14::json) RETURNING id`,[projectId,v.fileName,source.size,source.mimeType,version,root?.id??null,status,status!=="rejected",req.user!.userId,source.sha256,v.relationship,hooks.fileTypeTier(v.fileName),pendingPath,JSON.stringify({provider:"procore",sourceCompanyId:v.sourceCompanyId,sourceRef:v.ref,sourceVersionId:v.versionId,sourceSha256:source.sha256,importRequestId:v.requestId})]);
    fileId=Number(created.rows[0].id);
    if(family.length)await client.query("UPDATE files SET is_superseded=true,superseded_by_file_id=$1,updated_at=now() WHERE project_id=$2 AND id=ANY($3)",[fileId,projectId,family.map(row=>row.id)]);
   }
   const receipt:Receipt={schema:"procore-document-import-v1",requestId:v.requestId,requestDigest,projectId,companyId:req.user!.companyId,userId:req.user!.userId,fileId,fileName:recordName,sourceCompanyId:v.sourceCompanyId,sourceRef:v.ref,sourceVersionId:v.versionId,sourceSha256:source.sha256,relationship:v.relationship,reused,recordUrl:`/projects/${projectId}/files`,downloadUrl:`/api/v1/projects/${projectId}/files/${fileId}/download`,createdAt:new Date().toISOString()};
   await client.query("INSERT INTO activity_log(project_id,user_id,user_full_name,user_company_name,action_type,entity_type,entity_id,file_name_after,details) VALUES($1,$2,$3,$4,'procore_document_import','file',$5,$6,$7)",[projectId,req.user!.userId,req.user!.fullName,req.user!.companyName,fileId,recordName,JSON.stringify(receipt)]);
   await client.query("COMMIT");const storedPath=pendingPath;pendingPath=null;

   if(storedPath)await hooks.processFile(fileId,storedPath,recordName,projectId,req.user!.userId).catch(()=>console.error("[procore-import] saved file processing requires retry"));
   headers(res,req,projectId).status(201).json({receipt,replayed:false});
  }catch(error){if(client)await client.query("ROLLBACK");if(pendingPath)try{await store.delete(pendingPath);}catch{console.error("[procore-import] storage compensation requires retry");}failed(res,error);}finally{client?.release();}
 });
}
