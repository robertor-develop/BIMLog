export class MeetingImportFailure extends Error {
 constructor(public status:number,public code:string){super(code);}
}
type Attendee={trade:string|null;company:string|null;fullName:string|null;role:string|null;email:string|null;phone:string|null};
type Action={description:string|null;assignedToName:string|null;dueDate:string|null;status:string|null};
export type MeetingImportData={title:string|null;meetingDate:string|null;meetingTime:string|null;location:string|null;meetingNumber:string|null;notes:string|null;attendees:Attendee[];actionItems:Action[]};
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=="object"||Array.isArray(value))throw new MeetingImportFailure(422,"meeting_import_invalid_extraction");return value as Record<string,unknown>;};
const field=(row:Record<string,unknown>,key:string)=>{const value=row[key];if(value===undefined||value===null)return null;if(typeof value!=="string")throw new MeetingImportFailure(422,"meeting_import_invalid_extraction");return value.trim()||null;};
const date=(value:string|null)=>{if(!value)return null;const parsed=new Date(value);if(!Number.isFinite(parsed.getTime())||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&parsed.toISOString().slice(0,10)!==value))throw new MeetingImportFailure(422,"meeting_import_invalid_date");return value;};
export function normalizeMeetingImportData(value:unknown,requireMeaningful=true):MeetingImportData{
 const row=object(value);
 const list=(key:string)=>{const value=row[key];if(value===undefined||value===null)return [];if(!Array.isArray(value))throw new MeetingImportFailure(422,"meeting_import_invalid_extraction");return value.map(object);};
 const result:MeetingImportData={
  title:field(row,"title"),meetingDate:date(field(row,"meetingDate")),meetingTime:field(row,"meetingTime"),location:field(row,"location"),meetingNumber:field(row,"meetingNumber"),notes:field(row,"notes"),
  attendees:list("attendees").map(item=>({trade:field(item,"trade"),company:field(item,"company"),fullName:field(item,"fullName"),role:field(item,"role"),email:field(item,"email"),phone:field(item,"phone")})),
  actionItems:list("actionItems").map(item=>({description:field(item,"description"),assignedToName:field(item,"assignedToName"),dueDate:date(field(item,"dueDate")),status:field(item,"status")})),
 };
 if(requireMeaningful&&!result.title&&!result.meetingDate&&!result.location&&!result.notes&&!result.attendees.some(a=>a.fullName)&&!result.actionItems.some(a=>a.description))throw new MeetingImportFailure(422,"meeting_import_empty_extraction");
 return result;
}
export function meetingImportFileName(value:string){
 if(Array.from(value).some(char=>char.charCodeAt(0)>255))return value;
 const decoded=Buffer.from(value,"latin1").toString("utf8");return decoded.includes("\uFFFD")?value:decoded;
}


export function meetingImportTimestamp(data:MeetingImportData):Date{
 const value=data.meetingDate?new Date(data.meetingDate):new Date();
 if(!data.meetingTime||(data.meetingDate&&/\d{1,2}:\d{2}/.test(data.meetingDate)))return value;
 const time=data.meetingTime.replace(/\./g,"").replace(/\s+/g,"").toLowerCase().match(/^(\d{1,2})(?::([0-5]\d))?(?::([0-5]\d))?(am|pm)?$/);
 if(!time)throw new MeetingImportFailure(422,"meeting_import_invalid_date");
 let hour=Number(time[1]);if(time[4]){if(hour<1||hour>12)throw new MeetingImportFailure(422,"meeting_import_invalid_date");hour=hour%12+(time[4]==="pm"?12:0);}else if(hour>23)throw new MeetingImportFailure(422,"meeting_import_invalid_date");
 const minute=Number(time[2]??0),second=Number(time[3]??0);
 if(data.meetingDate&&/^\d{4}-\d{2}-\d{2}$/.test(data.meetingDate))return new Date(`${data.meetingDate}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:${String(second).padStart(2,"0")}`);
 value.setHours(hour,minute,second,0);return value;
}
