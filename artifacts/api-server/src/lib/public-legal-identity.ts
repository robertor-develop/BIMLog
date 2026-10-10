import { deriveCommercialLaunchProfile } from "./commercial-launch-profile";

export type PublicLegalIdentity = Readonly<{
  schemaVersion: "bimlog-public-legal-identity-v1";
  available: boolean;
  supplierName: string | null;
  supportEmail: string | null;
  invoiceJurisdiction: string | null;
}>;

export function derivePublicLegalIdentity(environment: NodeJS.ProcessEnv): PublicLegalIdentity {
  const profile = deriveCommercialLaunchProfile(environment);
  if (!profile.complete) {
    return Object.freeze({
      schemaVersion: "bimlog-public-legal-identity-v1",
      available: false,
      supplierName: null,
      supportEmail: null,
      invoiceJurisdiction: null,
    });
  }
  return Object.freeze({
    schemaVersion: "bimlog-public-legal-identity-v1",
    available: true,
    supplierName: profile.supplierName,
    supportEmail: profile.supportEmail,
    invoiceJurisdiction: profile.invoiceJurisdiction,
  });
}
