export type CommercialBillingIdentityDto={companyId:number;legalName:string;address:string;phone:string;status:"complete"|"incomplete";missingFields:("address"|"phone")[]};

export function parseCommercialBillingIdentity(value:unknown):CommercialBillingIdentityDto{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid billing identity response");
  const row=value as Record<string,unknown>;
  if(!Number.isSafeInteger(row.companyId)||Number(row.companyId)<1||typeof row.legalName!=="string"||!row.legalName.trim()||typeof row.address!=="string"||typeof row.phone!=="string"||!Array.isArray(row.missingFields))throw new Error("Invalid billing identity fields");
  const missingFields=row.missingFields.map(item=>{if(item!=="address"&&item!=="phone")throw new Error("Invalid billing identity missing field");return item;});
  if(new Set(missingFields).size!==missingFields.length)throw new Error("Invalid billing identity missing fields");
  const expected=[...(row.address.trim()?[]:["address" as const]),...(row.phone.trim()?[]:["phone" as const])];
  const status=row.status==="complete"||row.status==="incomplete"?row.status:null;
  if(!status||JSON.stringify(missingFields)!==JSON.stringify(expected)||(status==="complete")!==(expected.length===0))throw new Error("Invalid billing identity status");
  return {companyId:Number(row.companyId),legalName:row.legalName.trim(),address:row.address,phone:row.phone,status,missingFields};
}

async function request(input:{token:string;method:"GET"|"PATCH";body?:{address:string;phone:string};fetchImpl?:typeof fetch}){
  const base=typeof import.meta.env?.BASE_URL==="string"?import.meta.env.BASE_URL.replace(/\/$/,""):"";
  const response=await (input.fetchImpl??fetch)(`${base}/api/v1/commercial/billing-identity`,{method:input.method,headers:{Authorization:`Bearer ${input.token}`,...(input.body?{"Content-Type":"application/json"}:{})},...(input.body?{body:JSON.stringify(input.body)}:{})});
  const payload=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(typeof payload.error==="string"?payload.error:"Billing identity is unavailable.");
  return parseCommercialBillingIdentity(payload);
}

export const readCommercialBillingIdentity=(token:string,fetchImpl?:typeof fetch)=>request({token,method:"GET",fetchImpl});
export const saveCommercialBillingIdentity=(token:string,body:{address:string;phone:string},fetchImpl?:typeof fetch)=>request({token,method:"PATCH",body,fetchImpl});
