import crypto from "node:crypto";

export const BIMTECH_SETUP_MODULES = ["project","client","contract","scope","estimate","controlReference","executionPlan","financialBaseline","team","folderRouting"] as const;
const MODULE_SET = new Set<string>(BIMTECH_SETUP_MODULES);
const STATUS = new Set(["INCLUDED","INCOMPLETE","UNAVAILABLE"]);
const REASON = new Set(["NOT_CONFIGURED","ACCESS_DENIED","NO_ACTIVE_WORK_ITEMS","NO_CURRENT_ESTIMATE_CONFIGURATION","ROUTING_NOT_CONFIRMED","ROUTING_CONFIRMATION_STALE"]);
const SHA = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export class BimtechSetupPackageError extends Error {
  constructor(public status:number, public code:string, message:string){ super(message); }
}

type Json = null|boolean|number|string|Json[]|{[key:string]:Json};
function object(value:unknown, code:string):Record<string,any>{
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new BimtechSetupPackageError(400,code,"Expected a JSON object.");
  return value as Record<string,any>;
}
function canonical(value:any):string {
  if(value===null||typeof value!=="object") return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
export function setupPackageSha(value:unknown){return crypto.createHash("sha256").update(canonical(value),"utf8").digest("hex");}
function boundedTree(value:unknown){
  let nodes=0;
  const walk=(entry:unknown,depth:number)=>{
    if(depth>32) throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_DEPTH","Package nesting exceeds 32 levels.");
    if(++nodes>250_000) throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_COMPLEXITY","Package contains too many values.");
    if(Array.isArray(entry)){if(entry.length>50_000)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_ARRAY_LIMIT","A package array exceeds 50,000 rows."); for(const child of entry)walk(child,depth+1);}
    else if(entry&&typeof entry==="object"){const keys=Object.keys(entry);if(keys.length>2_000)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_OBJECT_LIMIT","A package object contains too many fields.");for(const key of keys){if(key==="__proto__"||key==="constructor"||key==="prototype")throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_UNSAFE_KEY","Unsafe object key rejected.");walk((entry as any)[key],depth+1);}}
    else if(typeof entry==="string"&&Buffer.byteLength(entry,"utf8")>2*1024*1024)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_STRING_LIMIT","A package value exceeds 2 MB.");
  };
  walk(value,0);
}
function count(body:any,key:string):number|undefined {
  if(Array.isArray(body?.[key])) return body[key].length;
  if(key==="project"||key==="client"||key==="contract") return body?.record?1:0;
  if(key==="canonicalRows") return Array.isArray(body?.breakdown?.estimateVersion?.canonical_payload)?body.breakdown.estimateVersion.canonical_payload.length:undefined;
  return undefined;
}
export type BimtechSetupPreview={
  format:"bimtech.setup-package";formatVersion:1;exportId:string;generatedAt:string;
  project:{id:string;organizationId:string;code:string;name:string;lifecycleStatus:string;revision:number};
  exporterAccess:Record<string,boolean>;contentSha256:string;packageSha256:string;
  modules:Array<{key:string;status:string;reason:string|null;redacted:boolean;recordCount:number}>;
  warnings:Array<{code:string;module:string|null;message:string}>;blockingReasons:string[];
  sourceUsers:Array<{sourceUserId:string;roles:string[]}>;canStage:boolean;requiresUserMapping:boolean;
};
export function validateBimtechSetupPackage(raw:unknown):{package:Record<string,any>;preview:BimtechSetupPreview}{
  const encoded=JSON.stringify(raw);if(Buffer.byteLength(encoded,"utf8")>5*1024*1024)throw new BimtechSetupPackageError(413,"BIMTECH_PACKAGE_SIZE","Setup package exceeds 5 MB.");
  boundedTree(raw); const pkg=object(raw,"BIMTECH_PACKAGE_OBJECT"), manifest=object(pkg.manifest,"BIMTECH_PACKAGE_MANIFEST"), modules=object(pkg.modules,"BIMTECH_PACKAGE_MODULES");
  if(pkg.format!=="bimtech.setup-package"||pkg.formatVersion!==1)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_FORMAT","Only bimtech.setup-package formatVersion 1 is supported.");
  const entries=Array.isArray(manifest.modules)?manifest.modules:[];
  if(entries.length!==BIMTECH_SETUP_MODULES.length||entries.some((entry:any,index:number)=>entry?.key!==BIMTECH_SETUP_MODULES[index]))throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_MANIFEST_MODULES","Manifest must contain the ten v1 modules in canonical order.");
  if(!SHA.test(String(manifest.contentSha256??""))||setupPackageSha(modules)!==manifest.contentSha256)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_CONTENT_HASH","Package content hash does not match.");
  const expected:string[]=[];const summary:BimtechSetupPreview["modules"]=[];
  for(const candidate of entries){
    const entry=object(candidate,"BIMTECH_PACKAGE_MODULE_ENTRY"),key=String(entry.key),status=String(entry.status),reason=entry.reason==null?null:String(entry.reason);
    if(!MODULE_SET.has(key)||!STATUS.has(status))throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_MODULE_STATUS",`Invalid module declaration: ${key}.`);
    if(status==="UNAVAILABLE"){if(!reason||!REASON.has(reason)||entry.sha256!==null||modules[key]!==undefined)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_UNAVAILABLE_MODULE",`${key} unavailable declaration is inconsistent.`);}
    else {expected.push(key);if(!SHA.test(String(entry.sha256??""))||setupPackageSha(modules[key])!==entry.sha256)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_MODULE_HASH",`${key} hash does not match.`);}
    let total=0;for(const [name,value] of Object.entries(entry.recordCounts??{})){if(!Number.isSafeInteger(value)||Number(value)<0)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_RECORD_COUNT",`${key}.${name} count is invalid.`);const actual=count(modules[key],name);if(actual!==undefined&&actual!==value)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_RECORD_COUNT",`${key}.${name} count does not match.`);total+=Number(value);}
    summary.push({key,status,reason,redacted:entry.redacted===true,recordCount:total});
  }
  if(Object.keys(modules).sort().join(",")!==expected.sort().join(","))throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_MODULE_PRESENCE","Module bodies do not match the manifest.");
  if(manifest.integrity?.status!=="PASS")throw new BimtechSetupPackageError(422,"BIMTECH_PACKAGE_INTEGRITY","BIMTECH reported failed package integrity.");
  if(manifest.consistency?.status!=="STABLE")throw new BimtechSetupPackageError(409,"BIMTECH_PACKAGE_UNSTABLE","BIMTECH package changed while exported. Export it again.");
  const routing=modules.folderRouting;if(routing?.binding&&Array.isArray(routing.resolvedPaths)){const lines=[...routing.resolvedPaths].sort((a,b)=>String(a.work_item_id).localeCompare(String(b.work_item_id))).map(row=>`${row.work_item_id}|${row.outcome}|${row.path??""}`);const digest=crypto.createHash("sha256").update(`routing-project-paths-v1\n${lines.join("\n")}`,"utf8").digest("hex");if(digest!==routing.binding.current_paths_hash)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_ROUTING_HASH","Routing paths hash does not match.");}
  const project=object(manifest.project,"BIMTECH_PACKAGE_PROJECT");if(!UUID.test(String(project.id??""))||!UUID.test(String(project.organizationId??"")))throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_PROJECT_ID","Source project identity is invalid.");
  if(!UUID.test(String(manifest.exportId??""))||!Number.isSafeInteger(project.revision)||project.revision<1)throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_EXPORT_ID","Export identity or revision is invalid.");
  const warnings=(manifest.integrity.findings??[]).filter((row:any)=>row?.severity==="WARNING").map((row:any)=>({code:String(row.code??"WARNING"),module:row.module==null?null:String(row.module),message:String(row.message??"")}));
  const blockingReasons=summary.filter(row=>row.status==="UNAVAILABLE"||row.status==="INCOMPLETE").map(row=>`${row.key}:${row.reason??row.status}`);
  const roleMap=new Map<string,Set<string>>();for(const row of modules.team?.assignments??[]){const id=String(row?.user_id??"");if(!UUID.test(id))throw new BimtechSetupPackageError(400,"BIMTECH_PACKAGE_TEAM_USER","Team assignment contains an invalid BIMTECH user identity.");if(!roleMap.has(id))roleMap.set(id,new Set());roleMap.get(id)!.add(String(row?.role_name??row?.role_code??"Team member"));}
  const sourceUsers=[...roleMap.entries()].map(([sourceUserId,roles])=>({sourceUserId,roles:[...roles].sort()}));
  return {package:pkg,preview:{format:"bimtech.setup-package",formatVersion:1,exportId:String(manifest.exportId),generatedAt:String(manifest.generatedAt??""),project:{id:String(project.id),organizationId:String(project.organizationId),code:String(project.code??""),name:String(project.name??""),lifecycleStatus:String(project.lifecycleStatus??""),revision:Number(project.revision)},exporterAccess:object(manifest.exporterAccess??{},"BIMTECH_PACKAGE_ACCESS"),contentSha256:String(manifest.contentSha256),packageSha256:setupPackageSha(pkg),modules:summary,warnings,blockingReasons,sourceUsers,canStage:true,requiresUserMapping:Boolean(sourceUsers.length)}};
}
