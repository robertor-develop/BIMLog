import type {CommercialIntent} from "./commercial-intent";
import type {CommercialWorkspaceDto} from "./commercial-workspace-client";

export type CommercialOfferHandoff={
  selectedFromPricing:boolean;
  matchesPreparedOffer:boolean;
  nextAction:"review"|"prepare"|"checkout"|"manage";
};

export function deriveCommercialOfferHandoff(intent:CommercialIntent|null,value:CommercialWorkspaceDto,selected:{plan:"professional"|"team"|"business";cycle:"monthly"|"annual"}):CommercialOfferHandoff{
  const prepared=value.preparedSubscription;
  const matchesPreparedOffer=Boolean(prepared&&prepared.plan===selected.plan&&prepared.billingCycle===selected.cycle);
  return Object.freeze({
    selectedFromPricing:Boolean(intent&&intent.plan===selected.plan&&intent.billing===selected.cycle),
    matchesPreparedOffer,
    nextAction:value.subscriptionStatus==="active"?"manage":matchesPreparedOffer?"checkout":value.subscriptionStatus==="not_configured"?"prepare":"review",
  });
}
