export const REPORT_MEASURES = [
  {key:"count",label:"Record count",definition:"Distinct current records in the selected project and filters.",source:"Canonical project registers"},
  {key:"coverage",label:"Coverage",definition:"Records with the required relationship divided by eligible records; it never means approval.",source:"Canonical relationship records"},
  {key:"completion",label:"Completion",definition:"Records in a canonical completed or closed state divided by in-scope records.",source:"Source workflow status history"},
  {key:"value",label:"Value",definition:"Recorded authorized monetary values in the chosen currency and scope; missing values are excluded.",source:"Commercial source records"},
] as const;
export type ReportMeasureKey=(typeof REPORT_MEASURES)[number]["key"];
export function reportMeasure(key:ReportMeasureKey){return REPORT_MEASURES.find(item=>item.key===key)!;}
export const REPORT_QUESTIONS=[
  {key:"health",label:"Is the project under control?",reports:["project-health","compliance","audit-certificate"]},
  {key:"workflow",label:"Which records need attention?",reports:["rfi-aging","submittal-status","meeting-minutes","change-order-log","transmittal-log"]},
  {key:"performance",label:"How is the team responding?",reports:["performance"]},
  {key:"verification",label:"What content requires verification?",reports:["cvr"]},
] as const;
export function reportInputs(key:string):string[]{
  if(key==="cvr")return ["CVR findings","selected date range","detail choice"];
  if(["rfi-aging","submittal-status","change-order-log","transmittal-log"].includes(key))return ["canonical register","record status","selected dates when available"];
  return ["project records","selected date range when available","detail choice"];
}
