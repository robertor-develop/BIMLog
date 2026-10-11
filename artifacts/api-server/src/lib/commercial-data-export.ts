import crypto from "node:crypto";

export type CustomerDataExportInput=Readonly<{
  request:Readonly<{id:number;kind:"export";state:"fulfilled";requestedAt:Date;fulfilledAt:Date}>;
  customer:Readonly<{id:number;email:string;fullName:string;jobTitle:string|null;phone:string|null;createdAt:Date}>;
  company:Readonly<{id:number;name:string;website:string|null;address:string|null;phone:string|null;industry:string|null;companyType:string|null;createdAt:Date}>;
}>;

export function createCustomerDataExport(input:CustomerDataExportInput){
  const payload={schema:"bimlog.customer-data-export.v1",generatedFor:{requestId:input.request.id},customer:{id:input.customer.id,email:input.customer.email,fullName:input.customer.fullName,jobTitle:input.customer.jobTitle,phone:input.customer.phone,createdAt:input.customer.createdAt.toISOString()},company:{id:input.company.id,name:input.company.name,website:input.company.website,address:input.company.address,phone:input.company.phone,industry:input.company.industry,companyType:input.company.companyType,createdAt:input.company.createdAt.toISOString()},request:{kind:input.request.kind,state:input.request.state,requestedAt:input.request.requestedAt.toISOString(),fulfilledAt:input.request.fulfilledAt.toISOString()}};
  const body=Buffer.from(`${JSON.stringify(payload,null,2)}\n`,"utf8");
  return Object.freeze({body,sha256:crypto.createHash("sha256").update(body).digest("hex")});
}
