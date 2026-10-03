import crypto from "node:crypto";

export type SupportCaseSatisfactionInput=Readonly<{rating:1|2|3|4|5;comment:string|null;requestKey:string}>;
const secretPattern=/(?:sk_(?:live|test)_|rk_(?:live|test)_|SG\.[A-Za-z0-9_-]{10,}\.|api[_ -]?key\s*[:=]|password\s*[:=]|bearer\s+[A-Za-z0-9._-]{12,})/i;

export function parseSupportCaseSatisfaction(value:unknown):SupportCaseSatisfactionInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Support satisfaction is invalid");
  const raw=value as Record<string,unknown>,rating=Number(raw.rating),requestKey=typeof raw.requestKey==="string"?raw.requestKey.trim():"";
  if(!Number.isInteger(rating)||rating<1||rating>5)throw new Error("Support satisfaction rating is invalid");
  if(!/^[A-Za-z0-9_-]{16,80}$/.test(requestKey))throw new Error("Support satisfaction request identity is invalid");
  const comment=raw.comment==null||raw.comment===""?null:typeof raw.comment==="string"?raw.comment.trim().replace(/\s+/g," "):undefined;
  if(comment===undefined||comment!==null&&(comment.length<4||comment.length>1000))throw new Error("Support satisfaction comment is invalid");
  if(comment&&secretPattern.test(comment))throw new Error("Credentials and secrets are not accepted");
  return Object.freeze({rating:rating as 1|2|3|4|5,comment,requestKey});
}
export const supportSatisfactionFingerprint=(input:SupportCaseSatisfactionInput)=>crypto.createHash("sha256").update(JSON.stringify({rating:input.rating,comment:input.comment})).digest("hex");
