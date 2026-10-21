export type JobLifecycleEvent =
  | { id:string; type:"INTAKE_ACTIVATED"; tenantId:number; projectId:number; at:string }
  | { id:string; type:"WORK_ASSIGNED"; tenantId:number; projectId:number; at:string; assigneeId:number }
  | { id:string; type:"HOURS_RECORDED"; tenantId:number; projectId:number; at:string; hours:number }
  | { id:string; type:"HOURS_REVIEWED"; tenantId:number; projectId:number; at:string; reviewerId:number; approved:boolean };

export function projectJobLifecycle(tenantId:number,projectId:number,events:JobLifecycleEvent[]){
  const scoped=events.filter(event=>event.tenantId===tenantId&&event.projectId===projectId);
  if(new Set(scoped.map(event=>event.id)).size!==scoped.length)throw new Error("DUPLICATE_LIFECYCLE_EVENT");
  let activated=false,assigneeId:number|null=null,hours=0,reviewedHours=0;
  const audit=scoped.map(event=>{
    if(event.type==="INTAKE_ACTIVATED")activated=true;
    else if(!activated)throw new Error("ACTIVATION_REQUIRED");
    else if(event.type==="WORK_ASSIGNED")assigneeId=event.assigneeId;
    else if(event.type==="HOURS_RECORDED"){if(!assigneeId)throw new Error("ASSIGNMENT_REQUIRED");if(event.hours<=0)throw new Error("POSITIVE_HOURS_REQUIRED");hours+=event.hours;}
    else {if(event.reviewerId===assigneeId)throw new Error("INDEPENDENT_REVIEW_REQUIRED");if(event.approved)reviewedHours=hours;}
    return {eventId:event.id,type:event.type,at:event.at};
  });
  return {tenantId,projectId,activated,assigneeId,hours,reviewedHours,status:reviewedHours===hours&&hours>0?"reviewed":hours>0?"hours_pending_review":assigneeId?"assigned":activated?"activated":"draft",audit};
}
