import crypto from "node:crypto";

export const SUPPORT_CASE_CATEGORIES=["billing","account","technical","data","other"] as const;
export const SUPPORT_CASE_PRIORITIES=["normal","urgent"] as const;
export const DATA_REQUEST_KINDS=["export","correction","deletion","restriction"] as const;
export type DataRequestKind=typeof DATA_REQUEST_KINDS[number];
export type SupportCaseInput=Readonly<{category:typeof SUPPORT_CASE_CATEGORIES[number];priority:typeof SUPPORT_CASE_PRIORITIES[number];subject:string;description:string;requestKey:string;dataRequestKind:DataRequestKind|null}>;
const secretPattern=/(?:sk_(?:live|test)_|rk_(?:live|test)_|SG\.[A-Za-z0-9_-]{10,}\.|api[_ -]?key\s*[:=]|password\s*[:=]|bearer\s+[A-Za-z0-9._-]{12,})/i;
const text=(value:unknown,label:string,min:number,max:number)=>{if(typeof value!=="string")throw new Error(`${label} is required`);const clean=value.trim().replace(/\s+/g," ");if(clean.length<min||clean.length>max)throw new Error(`${label} is invalid`);if(secretPattern.test(clean))throw new Error("Credentials and secrets are not accepted");return clean;};

export function parseSupportCaseInput(value:unknown):SupportCaseInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Support request is invalid");
  const raw=value as Record<string,unknown>,category=raw.category,priority=raw.priority,requestKey=typeof raw.requestKey==="string"?raw.requestKey.trim():"",dataRequestKind=raw.dataRequestKind;
  if(!SUPPORT_CASE_CATEGORIES.includes(category as SupportCaseInput["category"]))throw new Error("Support category is invalid");
  if(!SUPPORT_CASE_PRIORITIES.includes(priority as SupportCaseInput["priority"]))throw new Error("Support priority is invalid");
  if(!/^[A-Za-z0-9_-]{16,80}$/.test(requestKey))throw new Error("Support request identity is invalid");
  if(category==="data"&&!DATA_REQUEST_KINDS.includes(dataRequestKind as DataRequestKind))throw new Error("Data request type is required");
  if(category!=="data"&&dataRequestKind!==undefined&&dataRequestKind!==null&&dataRequestKind!=="")throw new Error("Data request type is only valid for data requests");
  return Object.freeze({category:category as SupportCaseInput["category"],priority:priority as SupportCaseInput["priority"],subject:text(raw.subject,"Subject",4,160),description:text(raw.description,"Description",10,4000),requestKey,dataRequestKind:category==="data"?dataRequestKind as DataRequestKind:null});
}
export const supportCaseFingerprint=(input:SupportCaseInput)=>crypto.createHash("sha256").update(JSON.stringify({category:input.category,priority:input.priority,subject:input.subject,description:input.description,dataRequestKind:input.dataRequestKind})).digest("hex");
