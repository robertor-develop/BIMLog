import type { EmailDeliveryInput, EmailProvider } from "./launch-configuration";

export type LaunchEmailCheck = Readonly<{
  provider: EmailProvider;
  status: "verified" | "rejected" | "unavailable";
  code: "connection_verified" | "credentials_rejected" | "provider_unavailable" | "configuration_invalid";
}>;

export type LaunchEmailDelivery = Readonly<{
  provider: EmailProvider;
  status: "sent" | "rejected" | "unavailable";
  code: "test_email_sent" | "credentials_rejected" | "provider_unavailable" | "configuration_invalid";
  providerMessageId?: string;
}>;

export type LaunchEmailProviderAdapter = Readonly<{
  verify(configuration: EmailDeliveryInput, secret: string): Promise<LaunchEmailCheck>;
  sendTest(configuration: EmailDeliveryInput, secret: string, recipient: string): Promise<LaunchEmailDelivery>;
}>;

export type LaunchEmailAdapters = Readonly<Record<EmailProvider, LaunchEmailProviderAdapter>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function selectLaunchEmailAdapter(configuration: EmailDeliveryInput, adapters: LaunchEmailAdapters) {
  if (configuration.provider !== "smtp" && configuration.provider !== "sendgrid") return null;
  return adapters[configuration.provider];
}

export async function verifyLaunchEmailProvider(input: {
  configuration: EmailDeliveryInput;
  secret: string;
  adapters: LaunchEmailAdapters;
}): Promise<LaunchEmailCheck> {
  const adapter = selectLaunchEmailAdapter(input.configuration, input.adapters);
  if (!adapter || !emailPattern.test(input.configuration.senderAddress?.trim() ?? "") || input.secret.length < 8) {
    return Object.freeze({ provider: input.configuration.provider === "sendgrid" ? "sendgrid" : "smtp", status: "rejected", code: "configuration_invalid" });
  }
  return adapter.verify(input.configuration, input.secret);
}

export async function sendLaunchTestEmail(input: {
  configuration: EmailDeliveryInput;
  secret: string;
  recipient: string;
  adapters: LaunchEmailAdapters;
}): Promise<LaunchEmailDelivery> {
  const adapter = selectLaunchEmailAdapter(input.configuration, input.adapters);
  if (!adapter || !emailPattern.test(input.recipient.trim()) || input.secret.length < 8) {
    return Object.freeze({ provider: input.configuration.provider === "sendgrid" ? "sendgrid" : "smtp", status: "rejected", code: "configuration_invalid" });
  }
  return adapter.sendTest(input.configuration, input.secret, input.recipient.trim().toLowerCase());
}
