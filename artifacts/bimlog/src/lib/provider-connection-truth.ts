export type ProviderTruthInput={key:string;availability:"available"|"setup_required"|"review_required";connected:boolean;permissionState?:string;lastSuccessfulOperationAt?:string|null;lastError?:string|null};
export function providerConnectionTruth(input:ProviderTruthInput){
  if(input.permissionState&&input.permissionState!=="approved")return {state:"permission_required",nextAction:"Contact company administrator"};
  if(!input.connected)return {state:input.availability==="review_required"?"review_required":"setup_required",nextAction:input.availability==="review_required"?"Request integration review":"Connect account"};
  if(input.lastError)return {state:"recovery_required",nextAction:"Review failure and reconnect"};
  if(!input.lastSuccessfulOperationAt)return {state:"connected_unverified",nextAction:"Run read-only verification"};
  return {state:"ready",nextAction:"Use integration"};
}
