export type CommercialBillingIdentityDto={companyId:number;legalName:string;address:string;phone:string;status:"complete"|"incomplete";missingFields:("address"|"phone")[]};

export function parseCommercialBillingIdentity(value:unknown):CommercialBillingIdentityDto{
  const invalid=()=>{throw new Error("Invalid billing identity status");};
  if(!value||typeof value!=="object"||Array.isArray(value))return invalid();
  const row=value as Record<string,unknown>;
  if(!Number.isSafeInteger(row.companyId)||Number(row.companyId)<1||typeof row.legalName!=="string"||!row.legalName.trim()||typeof row.address!=="string"||typeof row.phone!=="string"||!Array.isArray(row.missingFields))return invalid();
  const missingFields=row.missingFields as ("address"|"phone")[];
  const expected=[...(row.address.trim()?[]:["address" as const]),...(row.phone.trim()?[]:["phone" as const])];
  const status=row.status as "complete"|"incomplete";
  if(!["complete","incomplete"].includes(status)||missingFields.join()!=expected.join()||(status==="complete")!==!expected.length)return invalid();
  return {companyId:Number(row.companyId),legalName:row.legalName.trim(),address:row.address,phone:row.phone,status,missingFields};
}

async function request(input:{token:string;method:"GET"|"PATCH";body?:{address:string;phone:string};fetchImpl?:typeof fetch}){
  const base=typeof import.meta.env?.BASE_URL==="string"?import.meta.env.BASE_URL.replace(/\/$/,""):"";
  const response=await (input.fetchImpl??fetch)(`${base}/api/v1/commercial/billing-identity`,{method:input.method,headers:{Authorization:`Bearer ${input.token}`,...(input.body?{"Content-Type":"application/json"}:{})},...(input.body?{body:JSON.stringify(input.body)}:{})});
  const payload=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok)throw new Error(String(payload.error||"Billing identity unavailable"));
  return parseCommercialBillingIdentity(payload);
}

export const readCommercialBillingIdentity=(token:string,fetchImpl?:typeof fetch)=>request({token,method:"GET",fetchImpl});
export const saveCommercialBillingIdentity=(token:string,body:{address:string;phone:string},fetchImpl?:typeof fetch)=>request({token,method:"PATCH",body,fetchImpl});
