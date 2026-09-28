import { z } from "zod/v4";
const destinationSchema=z.object({siteId:z.string().trim().min(1).max(1024),siteLabel:z.string().trim().min(1).max(256),libraryId:z.string().trim().min(1).max(1024),libraryLabel:z.string().trim().min(1).max(256),granted:z.boolean(),configured:z.boolean()}).strict();
export type SharePointAllowedDestination=z.infer<typeof destinationSchema>;
export function sharePointAllowedDestinations(input:{companyId:number;projectId:number;destinations:unknown[]}){
 if(!Number.isSafeInteger(input.companyId)||input.companyId<=0||!Number.isSafeInteger(input.projectId)||input.projectId<=0)throw new Error("SHAREPOINT_DESTINATION_SCOPE_INVALID");
 const destinations=z.array(destinationSchema).max(100).parse(input.destinations).filter(item=>item.granted).map(item=>Object.freeze({siteId:item.siteId,siteLabel:item.siteLabel,libraryId:item.libraryId,libraryLabel:item.libraryLabel,configured:item.configured}));
 return Object.freeze({companyId:input.companyId,projectId:input.projectId,destinations,broadDiscoveryRequired:false,routingOwner:"folder_wizard" as const,lensOwnsSeparateRouting:false});
}
export function bindSharePointDestination(input:{allowed:readonly SharePointAllowedDestination[];siteId:string;libraryId:string}){
 const match=input.allowed.find(item=>item.granted&&item.siteId===input.siteId&&item.libraryId===input.libraryId);
 if(!match)throw new Error("SHAREPOINT_DESTINATION_NOT_GRANTED");
 return Object.freeze({siteId:match.siteId,siteLabel:match.siteLabel,libraryId:match.libraryId,libraryLabel:match.libraryLabel,routingOwner:"folder_wizard" as const});
}
