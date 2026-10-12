import type { EmailDeliveryInput } from "./launch-configuration";
import type { LaunchEmailAdapters, LaunchEmailDelivery } from "./launch-email-provider";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "headers">>;
export type SmtpLaunchProbe = Readonly<{
  verify(configuration: EmailDeliveryInput, password: string): Promise<"verified" | "rejected" | "unavailable">;
  send(configuration: EmailDeliveryInput, password: string, recipient: string): Promise<{ status: "sent" | "rejected" | "unavailable"; messageId?: string }>;
}>;

const statusCode = (status: "rejected" | "unavailable") => status === "rejected" ? "credentials_rejected" as const : "provider_unavailable" as const;

export function createLiveLaunchEmailAdapters(input: { fetchImpl?: FetchLike; smtp: SmtpLaunchProbe }): LaunchEmailAdapters {
  const fetchImpl = input.fetchImpl ?? fetch;
  return Object.freeze({
    smtp: Object.freeze({
      async verify(configuration: EmailDeliveryInput, secret: string) {
        const status = await input.smtp.verify(configuration, secret);
        return Object.freeze(status === "verified" ? { provider: "smtp", status, code: "connection_verified" } : { provider: "smtp", status, code: statusCode(status) });
      },
      async sendTest(configuration: EmailDeliveryInput, secret: string, recipient: string): Promise<LaunchEmailDelivery> {
        const result = await input.smtp.send(configuration, secret, recipient);
        return Object.freeze(result.status === "sent" ? { provider: "smtp", status: "sent", code: "test_email_sent", providerMessageId: result.messageId } : { provider: "smtp", status: result.status, code: statusCode(result.status) });
      },
    }),
    sendgrid: Object.freeze({
      async verify(_configuration: EmailDeliveryInput, secret: string) {
        try {
          const response = await fetchImpl("https://api.sendgrid.com/v3/scopes", { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
          if (response.ok) return Object.freeze({ provider: "sendgrid", status: "verified", code: "connection_verified" });
          if (response.status === 401 || response.status === 403) return Object.freeze({ provider: "sendgrid", status: "rejected", code: "credentials_rejected" });
          return Object.freeze({ provider: "sendgrid", status: "unavailable", code: "provider_unavailable" });
        } catch { return Object.freeze({ provider: "sendgrid", status: "unavailable", code: "provider_unavailable" }); }
      },
      async sendTest(configuration: EmailDeliveryInput, secret: string, recipient: string): Promise<LaunchEmailDelivery> {
        try {
          const response = await fetchImpl("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: recipient }] }], from: { email: configuration.senderAddress }, subject: "BIMLog synthetic launch configuration test", content: [{ type: "text/plain", value: "Synthetic BIMLog configuration test. No customer transaction was created." }] }), signal: AbortSignal.timeout(10_000) });
          if (response.ok) return Object.freeze({ provider: "sendgrid", status: "sent", code: "test_email_sent", providerMessageId: response.headers.get("x-message-id") ?? undefined });
          if (response.status === 401 || response.status === 403) return Object.freeze({ provider: "sendgrid", status: "rejected", code: "credentials_rejected" });
          return Object.freeze({ provider: "sendgrid", status: "unavailable", code: "provider_unavailable" });
        } catch { return Object.freeze({ provider: "sendgrid", status: "unavailable", code: "provider_unavailable" }); }
      },
    }),
  });
}
