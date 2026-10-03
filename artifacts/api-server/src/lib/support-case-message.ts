import crypto from "node:crypto";

export type SupportCaseMessageInput=Readonly<{body:string;requestKey:string}>;
const secretPattern=/(?:sk_(?:live|test)_|rk_(?:live|test)_|SG\.[A-Za-z0-9_-]{10,}\.|api[_ -]?key\s*[:=]|password\s*[:=]|bearer\s+[A-Za-z0-9._-]{12,})/i;

export function parseSupportCaseMessage(value:unknown):SupportCaseMessageInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("SUPPORT_MESSAGE_INVALID");
  const raw=value as Record<string,unknown>,body=typeof raw.body==="string"?raw.body.trim().replace(/\s+/g," "):"",requestKey=typeof raw.requestKey==="string"?raw.requestKey.trim():"";
  if(body.length<2||body.length>4000||secretPattern.test(body))throw new Error("SUPPORT_MESSAGE_INVALID");
  if(!/^[A-Za-z0-9_-]{16,80}$/.test(requestKey))throw new Error("SUPPORT_MESSAGE_INVALID");
  return Object.freeze({body,requestKey});
}

export const supportCaseMessageFingerprint=(input:SupportCaseMessageInput)=>crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
