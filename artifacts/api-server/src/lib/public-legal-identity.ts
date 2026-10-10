import { deriveCommercialLaunchProfile } from "./commercial-launch-profile";

export type PublicLegalIdentity = Readonly<{
  schemaVersion: "bimlog-public-legal-identity-v1";
  available: boolean;
  supplierName: string | null;
  registrationNumber: string | null;
  taxIdentifier: string | null;
  billingEmail: string | null;
  supportEmail: string | null;
  registeredAddress: string | null;
  invoiceJurisdiction: string | null;
}>;

export function derivePublicLegalIdentity(environment: NodeJS.ProcessEnv): PublicLegalIdentity {
  const profile = deriveCommercialLaunchProfile(environment);
  if (!profile.complete) {
    return Object.freeze({
      schemaVersion: "bimlog-public-legal-identity-v1",
      available: false,
      supplierName: null,
      registrationNumber: null,
      taxIdentifier: null,
      billingEmail: null,
      supportEmail: null,
      registeredAddress: null,
      invoiceJurisdiction: null,
    });
  }
  return Object.freeze({
    schemaVersion: "bimlog-public-legal-identity-v1",
    available: true,
    supplierName: profile.supplierName,
    registrationNumber: profile.registrationNumber,
    taxIdentifier: profile.taxIdentifier,
    billingEmail: profile.billingEmail,
    supportEmail: profile.supportEmail,
    registeredAddress: profile.registeredAddress,
    invoiceJurisdiction: profile.invoiceJurisdiction,
  });
}
