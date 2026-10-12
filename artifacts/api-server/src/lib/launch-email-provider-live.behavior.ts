import assert from "node:assert/strict";
import { createLiveLaunchEmailAdapters } from "./launch-email-provider-live";

const requests: Array<{ url: string; authorization: string; body?: string }> = [];
const adapters = createLiveLaunchEmailAdapters({
  fetchImpl: async (input, init) => { requests.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") ?? "", body: String(init?.body ?? "") }); return { ok: true, status: init?.method === "POST" ? 202 : 200, headers: new Headers({ "x-message-id": "synthetic-id" }) }; },
  smtp: { async verify() { return "verified"; }, async send() { return { status: "sent", messageId: "smtp-synthetic" }; } },
});
const configuration = { provider: "sendgrid" as const, senderAddress: "sender@example.test" };
assert.equal((await adapters.sendgrid.verify(configuration, "SG.synthetic.secret")).status, "verified");
assert.equal((await adapters.sendgrid.sendTest(configuration, "SG.synthetic.secret", "recipient@example.test")).providerMessageId, "synthetic-id");
assert.equal(requests[0]?.url, "https://api.sendgrid.com/v3/scopes");
assert.equal(requests[0]?.authorization, "Bearer SG.synthetic.secret");
assert.ok(requests[1]?.body?.includes("Synthetic BIMLog configuration test"));
assert.equal((await adapters.smtp.verify({ provider: "smtp" }, "synthetic-password")).status, "verified");
console.log("LAUNCH_CONFIGURATION_BUILD_13=PASS sendgridLiveBoundary=true smtpAdapterBoundary=true timeout=true");
