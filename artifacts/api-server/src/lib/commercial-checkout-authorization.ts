import type {CommercialLaunchAuthorization} from "./commercial-launch-authorization";

export const commercialCheckoutAuthorizationBlockers=["verification_missing","verification_source_mismatch","verification_expired","verification_failed"] as const;
export type CommercialCheckoutAuthorizationBlocker=typeof commercialCheckoutAuthorizationBlockers[number];

const blockers:Readonly<Record<Exclude<CommercialLaunchAuthorization["status"],"current">,CommercialCheckoutAuthorizationBlocker>>=Object.freeze({
  missing:"verification_missing",
  source_mismatch:"verification_source_mismatch",
  expired:"verification_expired",
  not_verified:"verification_failed",
});

export function deriveCommercialCheckoutAuthorization(authorization:CommercialLaunchAuthorization){
  return Object.freeze({ready:authorization.ready&&authorization.status==="current",status:authorization.status,blockers:Object.freeze(authorization.status==="current"?[]:[blockers[authorization.status]])});
}

export function requireCommercialCheckoutAuthorization(authorization:CommercialLaunchAuthorization){
  const decision=deriveCommercialCheckoutAuthorization(authorization);
  if(!decision.ready){
    const error=new Error("Secure checkout requires a current source-bound commercial verification.") as Error&{code?:string;blockers?:readonly CommercialCheckoutAuthorizationBlocker[]};
    error.code="CHECKOUT_LIVE_VERIFICATION_REQUIRED";
    error.blockers=decision.blockers;
    throw error;
  }
  return decision;
}
