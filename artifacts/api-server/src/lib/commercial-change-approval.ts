export interface ApprovedCommercialBaseline {projectId:number;budgetVersionId:string;budgetFingerprint:string;apuVersionId:string;apuFingerprint:string;currency:string;originalContractValue:string;currentApprovedValue:string;version:number;}
export interface CommercialChangeDecision {changeOrderId:string;status:"draft"|"pending_approval"|"approved"|"rejected";amount:string;currency:string;thresholdPolicyVersion:string;requiredApproverRoles:readonly string[];approvals:readonly {role:string;actorId:string;at:string}[];}
const cents=(value:string)=>{if(!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value))throw new Error("Amount is invalid.");const [w,f=""]=value.split(".");return BigInt(w)*100n+BigInt(f.padEnd(2,"0"));};
const text=(value:bigint)=>`${value/100n}.${(value%100n).toString().padStart(2,"0")}`;
export function applyApprovedCommercialChange(baseline:ApprovedCommercialBaseline,decision:CommercialChangeDecision){
  if(decision.currency!==baseline.currency)throw new Error("Currency does not match the approved baseline.");
  if(decision.status!=="approved")throw new Error("Only an approved Change Order can revise the approved baseline.");
  if(!decision.thresholdPolicyVersion||!decision.requiredApproverRoles.length)throw new Error("Versioned approval policy is required.");
  const roles=new Set(decision.approvals.map(row=>row.role));if(decision.requiredApproverRoles.some(role=>!roles.has(role)))throw new Error("Required approval threshold is not satisfied.");
  return Object.freeze({...baseline,currentApprovedValue:text(cents(baseline.currentApprovedValue)+cents(decision.amount)),version:baseline.version+1,priorBudgetVersionId:baseline.budgetVersionId,appliedChangeOrderId:decision.changeOrderId,thresholdPolicyVersion:decision.thresholdPolicyVersion});
}
