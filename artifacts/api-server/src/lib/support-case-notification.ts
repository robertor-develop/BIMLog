export type SupportNotificationKind="case_opened"|"customer_replied"|"administrator_replied"|"status_changed"|"satisfaction_submitted";
export type SupportNotification={type:string;title:string;message:string;actionUrl:string};
const id=(value:number)=>{if(!Number.isSafeInteger(value)||value<1)throw new Error("SUPPORT_NOTIFICATION_ID_INVALID");return value;};
export function supportNotification(kind:SupportNotificationKind,caseId:number,subject:string,status?:string):SupportNotification{
 const caseNumber=id(caseId),clean=subject.trim();if(!clean||clean.length>160)throw new Error("SUPPORT_NOTIFICATION_SUBJECT_INVALID");
 if(kind==="case_opened")return {type:"support_case_opened",title:`New support case #${caseNumber}`,message:clean,actionUrl:`/total-control?supportCase=${caseNumber}`};
 if(kind==="customer_replied")return {type:"support_customer_replied",title:`Customer replied to case #${caseNumber}`,message:clean,actionUrl:`/total-control?supportCase=${caseNumber}`};
 if(kind==="administrator_replied")return {type:"support_administrator_replied",title:`Support replied to case #${caseNumber}`,message:clean,actionUrl:`/settings/billing-support?supportCase=${caseNumber}`};
 if(kind==="satisfaction_submitted")return {type:"support_satisfaction_submitted",title:`Customer rated case #${caseNumber}`,message:clean,actionUrl:`/total-control?supportCase=${caseNumber}`};
 const normalized=status?.trim().toLowerCase();if(!normalized||!["open","in_progress","resolved","closed"].includes(normalized))throw new Error("SUPPORT_NOTIFICATION_STATUS_INVALID");
 return {type:"support_status_changed",title:`Support case #${caseNumber} updated`,message:`${clean} · ${normalized.replace("_"," ")}`,actionUrl:`/settings/billing-support?supportCase=${caseNumber}`};
}
export function uniqueSupportRecipients(values:readonly number[],exclude?:number){return [...new Set(values.map(id))].filter(value=>value!==exclude).sort((a,b)=>a-b);}
