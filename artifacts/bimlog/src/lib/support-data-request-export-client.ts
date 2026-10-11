const digest=/^[a-f0-9]{64}$/;
const filename=/^attachment; filename="(bimlog-data-export-[1-9][0-9]*\.json)"$/;
export type CustomerDataExportDownload=Readonly<{blob:Blob;filename:string;sha256:string}>;
function validRecord(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value)}
export async function readCustomerDataExport(response:Response):Promise<CustomerDataExportDownload>{
  if(!response.ok||response.headers.get("content-type")?.split(";",1)[0]!=="application/json")throw new Error("Invalid data export response");
  const match=filename.exec(response.headers.get("content-disposition")??""),sha256=response.headers.get("x-bimlog-content-sha256")??"",length=Number(response.headers.get("content-length"));
  if(!match||!digest.test(sha256)||!Number.isSafeInteger(length)||length<32||length>1048576)throw new Error("Invalid data export response");
  const blob=await response.blob();if(blob.size!==length)throw new Error("Invalid data export response");
  const actual=[...new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer()))].map(value=>value.toString(16).padStart(2,"0")).join("");
  if(actual!==sha256)throw new Error("Invalid data export response");
  let payload:unknown;try{payload=JSON.parse(await blob.text())}catch{throw new Error("Invalid data export response")}
  if(!validRecord(payload)||payload.schema!=="bimlog.customer-data-export.v1"||!validRecord(payload.generatedFor)||payload.generatedFor.requestId!==Number(match[1]!.match(/[1-9][0-9]*/)?.[0])||!validRecord(payload.customer)||!validRecord(payload.company)||!validRecord(payload.request)||payload.request.kind!=="export"||payload.request.state!=="fulfilled")throw new Error("Invalid data export response");
  return Object.freeze({blob,filename:match[1]!,sha256});
}
