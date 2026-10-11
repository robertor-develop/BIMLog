const digest=/^[a-f0-9]{64}$/;
const filename=/^attachment; filename="(bimlog-data-export-[1-9][0-9]*\.json)"$/;
export type CustomerDataExportDownload=Readonly<{blob:Blob;filename:string;sha256:string}>;
export async function readCustomerDataExport(response:Response):Promise<CustomerDataExportDownload>{
  if(!response.ok||response.headers.get("content-type")?.split(";",1)[0]!=="application/json")throw new Error("Invalid data export response");
  const match=filename.exec(response.headers.get("content-disposition")??""),sha256=response.headers.get("x-bimlog-content-sha256")??"";
  if(!match||!digest.test(sha256))throw new Error("Invalid data export response");
  const blob=await response.blob();if(blob.size<32)throw new Error("Invalid data export response");
  return Object.freeze({blob,filename:match[1]!,sha256});
}
