import type {CommercialCheckoutSummaryDto,CommercialWorkspaceDto} from "./commercial-workspace-client";

export type CommercialCheckoutReturnState="none"|"cancelled"|"verifying"|"verified"|"failed";
export function deriveCommercialCheckoutReturnState(input:{checkoutReturn:"success"|"cancelled"|null;latestCheckout:CommercialCheckoutSummaryDto|null;subscriptionStatus:CommercialWorkspaceDto["subscriptionStatus"]}):CommercialCheckoutReturnState{
  if(input.checkoutReturn===null)return "none";
  if(input.checkoutReturn==="cancelled")return "cancelled";
  const checkout=input.latestCheckout;
  if(!checkout||checkout.status==="creating"||checkout.status==="open")return "verifying";
  if(checkout.status==="completed"&&input.subscriptionStatus==="active")return "verified";
  if(checkout.status==="completed")return "verifying";
  return "failed";
}
