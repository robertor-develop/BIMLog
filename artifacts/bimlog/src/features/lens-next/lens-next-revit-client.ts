export const DEFAULT_REVIT_BRIDGE_ORIGIN="http://127.0.0.1:8876";
export type RevitOpenState="idle"|"connecting"|"opening"|"success"|"error";

type FetchLike=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
const json=async(response:Response,label:string)=>{const body=await response.json().catch(()=>null) as any;if(!response.ok)throw new Error(`${label} failed (${response.status})${body?.message?`: ${body.message}`:""}`);return body;};

export function validateRevitBridgeOrigin(value:string):string{
  const url=new URL(value);
  const port=Number(url.port);
  if(url.protocol!=="http:"||url.hostname!=="127.0.0.1"||!Number.isInteger(port)||port<8866||port>8965||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw new Error("Revit bridge origin must be an approved 127.0.0.1 port");
  return `http://127.0.0.1:${port}`;
}

export async function openLensIssueInRevit(input:{apiBaseUrl:string;authToken:string;bridgeOrigin:string;projectId:number;issueId:number;viewpointId:string;visualStateDigest:string;fetchImpl?:FetchLike}):Promise<{outcome:string;elementsSelected:number}>{
  const fetchImpl=input.fetchImpl??globalThis.fetch.bind(globalThis),bridge=validateRevitBridgeOrigin(input.bridgeOrigin),api=input.apiBaseUrl.replace(/\/$/,"");
  const session=await json(await fetchImpl(`${bridge}/v1/session`,{headers:{Accept:"application/json"}}),"Revit session") as {payload:{token:string;sessionId:string;expiresAt:string}};
  const localHeaders={Accept:"application/json",Authorization:`Bearer ${session.payload.token}`};
  const targetQuery=new URLSearchParams({projectId:String(input.projectId),issueId:String(input.issueId),viewpointId:input.viewpointId,visualStateDigest:input.visualStateDigest});
  const targetResult=await json(await fetchImpl(`${bridge}/v1/navigation-target?${targetQuery}`,{headers:localHeaders}),"Revit model binding") as {target:unknown};
  const platformHeaders={Accept:"application/json",Authorization:`Bearer ${input.authToken}`,"Content-Type":"application/json; charset=utf-8"};
  const created=await json(await fetchImpl(`${api}/projects/${input.projectId}/clash-reports/lens-next/issues/${input.issueId}/revit-navigation`,{method:"POST",credentials:"same-origin",headers:platformHeaders,body:JSON.stringify({target:targetResult.target})}),"BIMLog Revit request") as {requestId:string;expiresAt:string;targetDigest:string;target:unknown};
  const receiptResult=await json(await fetchImpl(`${bridge}/v1/open-request`,{method:"POST",headers:{...localHeaders,"Content-Type":"application/json; charset=utf-8"},body:JSON.stringify({requestId:created.requestId,sessionId:session.payload.sessionId,confirmationReason:"Open exact BIMLog issue in Revit",expiresAt:created.expiresAt,target:created.target})}),"Open in Revit") as {receipt:{outcome:string;elementsSelected:number}};
  await json(await fetchImpl(`${api}/projects/${input.projectId}/clash-reports/lens-next/issues/${input.issueId}/revit-navigation/${created.requestId}/receipt`,{method:"POST",credentials:"same-origin",headers:platformHeaders,body:JSON.stringify({receipt:receiptResult.receipt})}),"BIMLog Revit receipt");
  return receiptResult.receipt;
}
