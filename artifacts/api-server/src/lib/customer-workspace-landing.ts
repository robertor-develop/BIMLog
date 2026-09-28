export type CustomerWorkspaceLink={id:string;label:string;href:string;scope:"approved"|"internal";requiredCapability:string};
export function customerWorkspaceLanding(input:{projectId:number;actorCompanyId:number;projectCompanyId:number;capabilities:readonly string[];links:readonly CustomerWorkspaceLink[]}){
  if(input.actorCompanyId!==input.projectCompanyId)throw new Error("CUSTOMER_WORKSPACE_DENIED");
  const allowed=new Set(input.capabilities);
  const links=input.links.filter(link=>link.scope==="approved"&&allowed.has(link.requiredCapability)).map(link=>Object.freeze({id:link.id,label:link.label,href:link.href}));
  return Object.freeze({projectId:input.projectId,role:"customer" as const,links,internalInformationIncluded:false});
}
