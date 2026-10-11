export type PublicCommercialAvailabilityDto=Readonly<{schemaVersion:"bimlog-public-commercial-availability-v2";freeSignupAvailable:true;emailVerification:"required_before_project_setup";freeOffer:Readonly<{projectLimit:1;memberLimit:5;evaluationPeriodDays:null}>;paidPlans:"available"|"consultation_only";nextAction:"create_free_account"|"request_plan_consultation"}>;
export function parsePublicCommercialAvailability(value:unknown):PublicCommercialAvailabilityDto{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid commercial availability");
  const row=value as Record<string,unknown>,allowed=new Set(["schemaVersion","freeSignupAvailable","emailVerification","freeOffer","paidPlans","nextAction"]);
  if(Object.keys(row).some(key=>!allowed.has(key))||row.schemaVersion!=="bimlog-public-commercial-availability-v2"||row.freeSignupAvailable!==true||row.emailVerification!=="required_before_project_setup")throw new Error("Invalid commercial availability");
  const free=row.freeOffer as Record<string,unknown>|null;
  if(!free||Array.isArray(free)||Object.keys(free).some(key=>!["projectLimit","memberLimit","evaluationPeriodDays"].includes(key))||free.projectLimit!==1||free.memberLimit!==5||free.evaluationPeriodDays!==null)throw new Error("Invalid commercial availability");
  if(row.paidPlans!=="available"&&row.paidPlans!=="consultation_only")throw new Error("Invalid commercial availability");
  const expected=row.paidPlans==="available"?"create_free_account":"request_plan_consultation";
  if(row.nextAction!==expected)throw new Error("Invalid commercial availability");
  return row as PublicCommercialAvailabilityDto;
}
export async function fetchPublicCommercialAvailability(signal?:AbortSignal){const response=await fetch("/api/v1/public/commercial-availability",{signal,headers:{Accept:"application/json"}});if(!response.ok)throw new Error("Commercial availability could not be loaded");return parsePublicCommercialAvailability(await response.json());}
