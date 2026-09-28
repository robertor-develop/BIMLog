export type KnowledgeLookupItem={id:string;companyId:number;status:"approved"|"retired"|"draft";discipline:string;issueType:string;contextTags:readonly string[];title:string;sourceLabel:string;applicability:string};
export function lookupVerifiedKnowledge(input:{companyId:number;discipline:string;issueType:string;contextTags:readonly string[];capabilityAvailable:boolean;items:readonly KnowledgeLookupItem[]}){
  if(!input.capabilityAvailable)return Object.freeze({status:"unavailable" as const,items:[],fallback:"Continue the active issue workflow without knowledge suggestions.",automaticDecision:false});
  const tags=new Set(input.contextTags.map(value=>value.trim().toLowerCase()).filter(Boolean));
  const items=input.items.filter(item=>item.companyId===input.companyId&&item.status==="approved").map(item=>({item,score:(item.discipline===input.discipline?4:0)+(item.issueType===input.issueType?4:0)+item.contextTags.filter(tag=>tags.has(tag.toLowerCase())).length})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.item.id.localeCompare(b.item.id)).map(({item,score})=>Object.freeze({id:item.id,title:item.title,source:item.sourceLabel,applicability:item.applicability,score}));
  return Object.freeze({status:"available" as const,items,automaticDecision:false});
}
