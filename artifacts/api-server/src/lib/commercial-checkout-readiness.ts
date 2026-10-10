import {inspectCommercialPlatformReadiness,type CommercialSalesLaunchBlocker} from "./commercial-platform-readiness";

export const commercialCheckoutReadinessCodes=[
  "catalog_unavailable",
  "payment_provider_unavailable",
  "live_payments_required",
  "payment_confirmation_unavailable",
  "billing_self_service_unavailable",
  "customer_support_unavailable",
] as const;
export type CommercialCheckoutReadinessCode=typeof commercialCheckoutReadinessCodes[number];

const blockerCodes:Readonly<Record<CommercialSalesLaunchBlocker,CommercialCheckoutReadinessCode>>=Object.freeze({
  catalog:"catalog_unavailable",
  provider:"payment_provider_unavailable",
  live_mode:"live_payments_required",
  webhook:"payment_confirmation_unavailable",
  portal:"billing_self_service_unavailable",
  support:"customer_support_unavailable",
});

export function deriveCommercialCheckoutReadiness(environment:NodeJS.ProcessEnv){
  const readiness=inspectCommercialPlatformReadiness(environment);
  const blockers=Object.freeze(readiness.salesLaunchBlockers.map(blocker=>blockerCodes[blocker]));
  return Object.freeze({ready:readiness.salesLaunchStatus==="ready",status:readiness.salesLaunchStatus,blockers});
}

export function requireCommercialCheckoutReadiness(environment:NodeJS.ProcessEnv){
  const readiness=deriveCommercialCheckoutReadiness(environment);
  if(!readiness.ready){
    const error=new Error("Secure checkout is not available until BIMLog completes the required payment and customer-service setup.") as Error&{code?:string;blockers?:readonly CommercialCheckoutReadinessCode[]};
    error.code="CHECKOUT_PLATFORM_NOT_READY";
    error.blockers=readiness.blockers;
    throw error;
  }
  return readiness;
}
