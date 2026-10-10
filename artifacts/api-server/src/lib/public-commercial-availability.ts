import { inspectCommercialPlatformReadiness } from "./commercial-platform-readiness";

export type PublicCommercialAvailability = Readonly<{
  schemaVersion: "bimlog-public-commercial-availability-v1";
  freeSignupAvailable: true;
  paidPlans: "available" | "consultation_only";
  nextAction: "create_free_account" | "request_plan_consultation";
}>;

export function derivePublicCommercialAvailability(environment: NodeJS.ProcessEnv): PublicCommercialAvailability {
  const paidReady = inspectCommercialPlatformReadiness(environment).salesLaunchStatus === "ready";
  return Object.freeze({
    schemaVersion: "bimlog-public-commercial-availability-v1",
    freeSignupAvailable: true,
    paidPlans: paidReady ? "available" : "consultation_only",
    nextAction: paidReady ? "create_free_account" : "request_plan_consultation",
  });
}
