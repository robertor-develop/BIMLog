import { deriveCommercialLaunchProfile } from "./commercial-launch-profile";

export type PublicLegalIdentity = Readonly<{
  schemaVersion: "bimlog-public-legal-identity-v1";
  available: boolean;
  supplierName: string | null;
  supportEmail: string | null;
  invoiceJurisdiction: string | null;
}>;

const PUBLIC_LEGAL_IDENTITY_DEFAULTS = Object.freeze({
  supplierName: "BIMCapital Partners INC",
  supportEmail: "info@ignitesmart.ai",
  invoiceJurisdiction: "Florida, United States",
});

export function derivePublicLegalIdentity(environment: NodeJS.ProcessEnv): PublicLegalIdentity {
  const profile = deriveCommercialLaunchProfile(environment);
  return Object.freeze({
    schemaVersion: "bimlog-public-legal-identity-v1",
    available: true,
    supplierName: profile.supplierName ?? PUBLIC_LEGAL_IDENTITY_DEFAULTS.supplierName,
    supportEmail: profile.supportEmail ?? PUBLIC_LEGAL_IDENTITY_DEFAULTS.supportEmail,
    invoiceJurisdiction: profile.invoiceJurisdiction ?? PUBLIC_LEGAL_IDENTITY_DEFAULTS.invoiceJurisdiction,
  });
}
