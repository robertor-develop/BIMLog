import { useAuthStore } from "@/store/auth";
import { logClientError } from "@/lib/client-log";
const API=(import.meta.env.BASE_URL||"").replace(/\/$/,"")+"/api/v1";
export type AdoptionMilestone="today_viewed"|"primary_action_opened"|"onboarding_completed"|"first_project_opened";
export function recordAdoptionMilestone(milestone:AdoptionMilestone,surface:"headquarters"|"onboarding"|"project"){
  const token=useAuthStore.getState().token;if(!token)return;
  void fetch(`${API}/onboarding/milestones`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({milestone,surface})}).catch((error)=>logClientError("adoption milestone delivery",error));
}
