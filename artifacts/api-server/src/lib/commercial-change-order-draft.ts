import type {PotentialCommercialImpact} from "./commercial-potential-impact";
export interface CommercialChangeDraft { draftId:string; projectId:number; canonicalChangeOrderId:string|null; state:"draft"; impactIds:readonly string[]; sourceLinks:readonly {type:string;id:string;version:string}[]; createdBy:string; createdAt:string; }
export function routeImpactsToChangeOrderDraft(input:{projectId:number;requestKey:string;impacts:readonly PotentialCommercialImpact[];existing:readonly CommercialChangeDraft[];canonicalChangeOrderId?:string|null;createdBy:string;createdAt:string}){
  if(!input.impacts.length)throw new Error("At least one reviewed potential impact is required.");
  if(input.impacts.some(row=>row.projectId!==input.projectId||row.authority!=="potential_only"))throw new Error("Potential impact scope is invalid.");
  const impactIds=[...new Set(input.impacts.map(row=>row.impactId))].sort();
  if(impactIds.length!==input.impacts.length)throw new Error("Duplicate potential impact supplied.");
  const draftId=`co-draft:${input.projectId}:${input.requestKey.trim()}`;
  const prior=input.existing.find(row=>row.draftId===draftId);
  if(prior){if(JSON.stringify(prior.impactIds)!==JSON.stringify(impactIds))throw new Error("Change Order draft retry conflicts with its original lineage.");return prior;}
  return Object.freeze({draftId,projectId:input.projectId,canonicalChangeOrderId:input.canonicalChangeOrderId??null,state:"draft" as const,impactIds:Object.freeze(impactIds),sourceLinks:Object.freeze(input.impacts.map(row=>({type:row.sourceType,id:row.sourceId,version:row.sourceVersion})).sort((a,b)=>`${a.type}:${a.id}:${a.version}`.localeCompare(`${b.type}:${b.id}:${b.version}`))),createdBy:input.createdBy,createdAt:input.createdAt});
}
