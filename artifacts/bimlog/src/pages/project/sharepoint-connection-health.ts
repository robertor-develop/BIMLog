export type SharePointConnectionHealth="connected"|"setup_incomplete"|"disconnected"|"temporarily_unavailable"|"administrator_required";
export function sharePointConnectionHealth(input:{httpStatus:number;credentialStates:readonly string[];destinationState:string|null;providerUnavailable:boolean}):SharePointConnectionHealth{
 if(input.httpStatus===403)return"administrator_required";
 if(input.httpStatus<200||input.httpStatus>=300||input.providerUnavailable)return"temporarily_unavailable";
 if(input.credentialStates.includes("revoked")||input.credentialStates.includes("disabled"))return"disconnected";
 if(input.credentialStates.includes("active")&&input.destinationState==="active")return"connected";
 return"setup_incomplete";
}
