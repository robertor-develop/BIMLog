import assert from "node:assert/strict";
import { sendLaunchTestEmail, verifyLaunchEmailProvider, type LaunchEmailAdapters } from "./launch-email-provider";

const calls: string[] = [];
const adapter = (provider: "smtp" | "sendgrid") => ({
  async verify(_configuration: unknown, secret: string) { calls.push(`${provider}:verify:${secret.length}`); return { provider, status: "verified", code: "connection_verified" } as const; },
  async sendTest(_configuration: unknown, secret: string, recipient: string) { calls.push(`${provider}:send:${secret.length}:${recipient}`); return { provider, status: "sent", code: "test_email_sent", providerMessageId: "synthetic-message" } as const; },
});
const adapters: LaunchEmailAdapters = { smtp: adapter("smtp"), sendgrid: adapter("sendgrid") };
const configuration = { provider: "smtp" as const, senderAddress: "sender@example.test", senderDomain: "example.test" };
assert.equal((await verifyLaunchEmailProvider({ configuration, secret: "synthetic-secret", adapters })).status, "verified");
assert.equal((await sendLaunchTestEmail({ configuration, secret: "synthetic-secret", recipient: "Person@Example.test", adapters })).status, "sent");
assert.deepEqual(calls, ["smtp:verify:16", "smtp:send:16:person@example.test"]);
assert.equal((await sendLaunchTestEmail({ configuration, secret: "short", recipient: "bad", adapters })).code, "configuration_invalid");
console.log("LAUNCH_CONFIGURATION_BUILD_12=PASS providerNeutral=true exactRouting=true invalidRefused=true");
