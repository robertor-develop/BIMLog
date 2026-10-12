export const launchReadinessStates = [
  "DEVELOPMENT_INCOMPLETE",
  "INTERNAL_TEST_READY",
  "GA_CANDIDATE_CONFIGURATION_READY",
  "LAUNCH_CONFIGURATION_ENTERED",
  "FINAL_ACTIVATION_VERIFIED",
  "GENERAL_AVAILABILITY_APPROVED",
] as const;

export type LaunchReadinessState = (typeof launchReadinessStates)[number];

export type LaunchConfigurationSectionStatus = "not_configured" | "invalid" | "ready" | "active";

export type LaunchConfigurationSection<T> = Readonly<{
  status: LaunchConfigurationSectionStatus;
  value: Readonly<T> | null;
  issues: readonly string[];
}>;

export const ownerReservedLaunchFields = Object.freeze([
  "legalBusinessName",
  "businessIdentificationNumber",
  "businessAddress",
  "billingAddress",
  "supportEmail",
  "transactionalEmailAddress",
  "emailProvider",
  "manualPaymentMethods",
] as const);

export function isLaunchReadinessState(value: string): value is LaunchReadinessState {
  return (launchReadinessStates as readonly string[]).includes(value);
}

export type BusinessIdentityInput = Readonly<{
  legalBusinessName?: string;
  tradeName?: string;
  businessIdentificationNumber?: string;
  country?: string;
  jurisdiction?: string;
  businessAddress?: string;
  billingAddress?: string;
  supportEmail?: string;
  billingEmail?: string;
  logoReference?: string;
}>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: string | undefined, max: number) => {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= max ? normalized : null;
};

export function inspectBusinessIdentity(input: BusinessIdentityInput): LaunchConfigurationSection<BusinessIdentityInput> {
  const value = Object.freeze({
    legalBusinessName: clean(input.legalBusinessName, 160) ?? undefined,
    tradeName: clean(input.tradeName, 160) ?? undefined,
    businessIdentificationNumber: clean(input.businessIdentificationNumber, 100) ?? undefined,
    country: clean(input.country, 120) ?? undefined,
    jurisdiction: clean(input.jurisdiction, 160) ?? undefined,
    businessAddress: clean(input.businessAddress, 320) ?? undefined,
    billingAddress: clean(input.billingAddress, 320) ?? undefined,
    supportEmail: clean(input.supportEmail, 254)?.toLowerCase() ?? undefined,
    billingEmail: clean(input.billingEmail, 254)?.toLowerCase() ?? undefined,
    logoReference: clean(input.logoReference, 500) ?? undefined,
  });
  const issues: string[] = [];
  for (const field of ["legalBusinessName", "businessIdentificationNumber", "country", "jurisdiction", "businessAddress", "billingAddress"] as const) {
    if (!value[field]) issues.push(`${field}_required`);
  }
  if (!value.supportEmail || !emailPattern.test(value.supportEmail)) issues.push("supportEmail_invalid");
  if (!value.billingEmail || !emailPattern.test(value.billingEmail)) issues.push("billingEmail_invalid");
  return Object.freeze({
    status: issues.length ? "invalid" : "ready",
    value,
    issues: Object.freeze(issues),
  });
}

export type EmailProvider = "smtp" | "sendgrid";
export type EmailDeliveryInput = Readonly<{
  provider?: EmailProvider;
  senderAddress?: string;
  senderDomain?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPasswordSecretReference?: string;
  sendgridApiKeySecretReference?: string;
  active?: boolean;
}>;

export function inspectEmailDelivery(input: EmailDeliveryInput): LaunchConfigurationSection<EmailDeliveryInput> {
  const issues: string[] = [];
  if (input.provider !== "smtp" && input.provider !== "sendgrid") issues.push("emailProvider_required");
  if (!input.senderAddress || !emailPattern.test(input.senderAddress.trim())) issues.push("senderAddress_invalid");
  const domain = input.senderDomain?.trim().toLowerCase();
  if (!domain || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) issues.push("senderDomain_invalid");
  if (input.provider === "smtp") {
    if (!clean(input.smtpHost, 253)) issues.push("smtpHost_required");
    if (!Number.isInteger(input.smtpPort) || Number(input.smtpPort) < 1 || Number(input.smtpPort) > 65535) issues.push("smtpPort_invalid");
    if (!clean(input.smtpUsername, 254)) issues.push("smtpUsername_required");
    if (!clean(input.smtpPasswordSecretReference, 500)) issues.push("smtpSecret_required");
  }
  if (input.provider === "sendgrid" && !clean(input.sendgridApiKeySecretReference, 500)) issues.push("sendgridSecret_required");
  const value = Object.freeze({ ...input, senderAddress: input.senderAddress?.trim().toLowerCase(), senderDomain: domain });
  return Object.freeze({ status: issues.length ? "invalid" : input.active ? "active" : "ready", value, issues: Object.freeze(issues) });
}

export function maskSecretReference(reference: string | undefined) {
  if (!reference?.trim()) return null;
  const normalized = reference.trim();
  return normalized.length <= 8 ? "••••••••" : `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}
