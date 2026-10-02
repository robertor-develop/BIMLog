export type SupportCaseAssignmentInput=Readonly<{expectedUpdatedAt:Date;assigned:boolean}>;
export function parseSupportCaseAssignment(value:unknown):SupportCaseAssignmentInput{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("SUPPORT_CASE_ASSIGNMENT_INVALID");
  const row=value as Record<string,unknown>;
  if(typeof row.assigned!=="boolean"||typeof row.expectedUpdatedAt!=="string")throw new Error("SUPPORT_CASE_ASSIGNMENT_INVALID");
  const expectedUpdatedAt=new Date(row.expectedUpdatedAt);
  if(Number.isNaN(expectedUpdatedAt.getTime())||expectedUpdatedAt.toISOString()!==row.expectedUpdatedAt)throw new Error("SUPPORT_CASE_ASSIGNMENT_INVALID");
  return Object.freeze({expectedUpdatedAt,assigned:row.assigned});
}
export function canChangeSupportCaseAssignment(currentAssigneeId:number|null,actorId:number,assigned:boolean):boolean{
  if(!Number.isSafeInteger(actorId)||actorId<1)throw new Error("SUPPORT_CASE_ACTOR_INVALID");
  return currentAssigneeId===actorId||assigned&&currentAssigneeId===null;
}
