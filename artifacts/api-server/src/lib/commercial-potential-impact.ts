export type CommercialImpactSourceType = "rfi" | "submittal" | "daily_field_record" | "inspection";
export interface PotentialCommercialImpactInput { projectId:number; sourceType:CommercialImpactSourceType; sourceId:string; sourceVersion:string; currency:string; potentialCost:string|null; potentialDays:number|null; description:string; recordedBy:string; recordedAt:string; }
export interface PotentialCommercialImpact extends PotentialCommercialImpactInput { impactId:string; authority:"potential_only"; approvedContractValue:false; }
const clean=(value:string,field:string)=>{const result=value.trim();if(!result||result.length>2000||/[\u0000-\u001f\u007f]/.test(result))throw new Error(`${field} is invalid.`);return result;};
const money=(value:string|null)=>{if(value===null)return null;if(!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value))throw new Error("Potential cost is invalid.");const [whole,fraction=""]=value.split(".");return `${whole}.${fraction.padEnd(2,"0")}`;};
export function capturePotentialCommercialImpact(input:PotentialCommercialImpactInput,existing:readonly PotentialCommercialImpact[]):PotentialCommercialImpact{
  if(!Number.isInteger(input.projectId)||input.projectId<=0)throw new Error("Project is invalid.");
  if(input.potentialCost===null&&input.potentialDays===null)throw new Error("A potential time or cost impact is required.");
  if(input.potentialDays!==null&&(!Number.isInteger(input.potentialDays)||Math.abs(input.potentialDays)>10000))throw new Error("Potential days are invalid.");
  const sourceId=clean(input.sourceId,"sourceId"),sourceVersion=clean(input.sourceVersion,"sourceVersion");
  const impactId=`potential:${input.projectId}:${input.sourceType}:${sourceId}:${sourceVersion}`;
  const prior=existing.find(row=>row.impactId===impactId);if(prior)return prior;
  return Object.freeze({...input,sourceId,sourceVersion,currency:clean(input.currency,"currency").toUpperCase(),potentialCost:money(input.potentialCost),description:clean(input.description,"description"),recordedBy:clean(input.recordedBy,"recordedBy"),impactId,authority:"potential_only",approvedContractValue:false});
}
