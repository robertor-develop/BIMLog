export const REPORT_MEASURES = [
  {key:"count",label:"Record count",definition:"Distinct current records in the selected project and filters.",source:"Canonical project registers"},
  {key:"coverage",label:"Coverage",definition:"Records with the required relationship divided by eligible records; it never means approval.",source:"Canonical relationship records"},
  {key:"completion",label:"Completion",definition:"Records in a canonical completed or closed state divided by in-scope records.",source:"Source workflow status history"},
  {key:"value",label:"Value",definition:"Recorded authorized monetary values in the chosen currency and scope; missing values are excluded.",source:"Commercial source records"},
] as const;
export type ReportMeasureKey=(typeof REPORT_MEASURES)[number]["key"];
export function reportMeasure(key:ReportMeasureKey){return REPORT_MEASURES.find(item=>item.key===key)!;}
