export const SUPPORT_CASE_STATUSES=["open","in_progress","resolved","closed"] as const;
export type SupportCaseStatus=typeof SUPPORT_CASE_STATUSES[number];
export type SupportCaseWorkload="urgent"|"waiting"|"resolved";
const transitions:Record<SupportCaseStatus,readonly SupportCaseStatus[]>={open:["in_progress","resolved"],in_progress:["resolved"],resolved:["in_progress","closed"],closed:[]};

export function parseSupportCaseStatusChange(value:unknown):Readonly<{expectedStatus:SupportCaseStatus;status:SupportCaseStatus;expectedUpdatedAt:Date}>{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("SUPPORT_CASE_TRANSITION_INVALID");
  const raw=value as Record<string,unknown>,expectedStatus=raw.expectedStatus,status=raw.status,expectedUpdatedAt=new Date(String(raw.expectedUpdatedAt??""));
  if(!SUPPORT_CASE_STATUSES.includes(expectedStatus as SupportCaseStatus)||!SUPPORT_CASE_STATUSES.includes(status as SupportCaseStatus)||!Number.isFinite(expectedUpdatedAt.getTime())||!transitions[expectedStatus as SupportCaseStatus].includes(status as SupportCaseStatus))throw new Error("SUPPORT_CASE_TRANSITION_INVALID");
  return Object.freeze({expectedStatus:expectedStatus as SupportCaseStatus,status:status as SupportCaseStatus,expectedUpdatedAt});
}
export function supportCaseWorkload(input:{status:SupportCaseStatus;priority:"normal"|"urgent"}):SupportCaseWorkload{return input.status==="resolved"||input.status==="closed"?"resolved":input.priority==="urgent"?"urgent":"waiting";}
