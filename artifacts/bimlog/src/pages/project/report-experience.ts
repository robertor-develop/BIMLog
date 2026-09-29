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
export function reportExportPreview(input:{label:string;from:string;to:string;status:string;includeDetails:boolean;visibleRows?:number}){
  return {scope:input.label,dateRange:input.from||input.to?`${input.from||"Any start"} to ${input.to||"Any end"}`:"All dates",status:input.status,detail:input.includeDetails?"Supporting rows included":"Summary totals only",visibleRows:input.visibleRows??null};
}
export const EVIDENCE_HISTORY_SOURCES=[
  {key:"files",label:"File versions",path:"files",authority:"Document and evidence custody"},
  {key:"rfis",label:"RFI responses and revisions",path:"rfis",authority:"RFI workflow history"},
  {key:"submittals",label:"Submittal package revisions",path:"submittals",authority:"Submittal review history"},
  {key:"meetings",label:"Meeting records",path:"meetings",authority:"Meeting record history"},
  {key:"changes",label:"Change records",path:"change-orders",authority:"Commercial change history"},
  {key:"transmittals",label:"Transmittal records",path:"transmittals",authority:"Delivery history"},
] as const;
export function evidenceHistoryHref(projectId:number,path:string){return `/projects/${projectId}/${path}?from=${encodeURIComponent(`/projects/${projectId}/reports`)}`;}
export type EvidenceSufficiency="unrated"|"assumed"|"measured";
export function evidenceSufficiency(input:{measuredValue?:number|null;assumption?:string|null}):{state:EvidenceSufficiency;label:string;meaning:string}{
  if(typeof input.measuredValue==="number"&&Number.isFinite(input.measuredValue))return {state:"measured",label:"Measured",meaning:"Calculated from identified source records in the selected scope."};
  if(input.assumption?.trim())return {state:"assumed",label:"Assumed",meaning:"Scenario value supplied as an assumption; it is not observed performance."};
  return {state:"unrated",label:"Unrated",meaning:"Evidence is insufficient; no outcome or performance rating is stated."};
}
