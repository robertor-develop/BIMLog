import { useAuthStore } from "@/store/auth";
import { logClientError } from "@/lib/client-log";
const API=(import.meta.env.BASE_URL||"").replace(/\/$/,"")+"/api/v1";
export type AdoptionMilestone="today_viewed"|"primary_action_opened"|"onboarding_completed"|"first_project_opened";
export async function deliverAdoptionMilestone(token:string,milestone:AdoptionMilestone,surface:"headquarters"|"onboarding"|"project"){
  const response=await fetch(`${API}/onboarding/milestones`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({milestone,surface})});
  if(!response.ok)throw new Error(`milestone endpoint returned ${response.status}`);
  const body=await response.json();
  if(body.recorded!==true||typeof body.event?.id!=="string"||typeof body.event?.createdAt!=="string")throw new Error("Invalid milestone evidence response");
  return body.event as {id:string;createdAt:string};
}
export function recordAdoptionMilestone(milestone:AdoptionMilestone,surface:"headquarters"|"onboarding"|"project"){
  const token=useAuthStore.getState().token;if(!token)return;
  void deliverAdoptionMilestone(token,milestone,surface).catch((error)=>logClientError("adoption milestone delivery",error));
}
