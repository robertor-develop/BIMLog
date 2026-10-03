export const SUPPORT_CASE_EVENT_TYPES=["opened","assigned","released","status_changed"] as const;
export type SupportCaseEventType=typeof SUPPORT_CASE_EVENT_TYPES[number];

export function supportCaseEvent(input:{type:SupportCaseEventType;actorUserId:number;fromValue?:string|null;toValue?:string|null}){
  if(!Number.isSafeInteger(input.actorUserId)||input.actorUserId<1)throw new Error("SUPPORT_EVENT_ACTOR_INVALID");
  const clean=(value:string|null|undefined)=>value==null?null:value.trim();
  const fromValue=clean(input.fromValue),toValue=clean(input.toValue);
  if(input.type==="opened"&&(fromValue!==null||toValue!=="open"))throw new Error("SUPPORT_EVENT_OPEN_INVALID");
  if(input.type==="assigned"&&(fromValue!==null||toValue===null))throw new Error("SUPPORT_EVENT_ASSIGN_INVALID");
  if(input.type==="released"&&(fromValue===null||toValue!==null))throw new Error("SUPPORT_EVENT_RELEASE_INVALID");
  if(input.type==="status_changed"&&(fromValue===null||toValue===null||fromValue===toValue))throw new Error("SUPPORT_EVENT_STATUS_INVALID");
  return {eventType:input.type,actorUserId:input.actorUserId,fromValue,toValue};
}
