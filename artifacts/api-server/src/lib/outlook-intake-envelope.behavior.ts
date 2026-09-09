import assert from "node:assert/strict";
import { parseOutlookIntakeEnvelope } from "./outlook-intake-envelope";

const input = { provider: "microsoft_graph", mailboxCredentialId: "cred-1", internetMessageId: "message@example", providerMessageId: "provider-1", conversationId: "conversation-1", receivedAt: "2026-09-09T11:00:00Z", sender: "SENDER@EXAMPLE.COM", recipients: ["Team@Example.com"], subject: "Coordination package", bodyPreview: "Attached for controlled intake.", hasAttachments: true, attachmentRefs: [{ providerAttachmentId: "attachment-1", name: "coordination.ifc", byteSize: 42 }] };
const parsed = parseOutlookIntakeEnvelope(input);
assert.equal(parsed.sender, "sender@example.com");
assert.deepEqual(parsed.recipients, ["team@example.com"]);
assert.equal("accessToken" in parsed, false);
await assert.rejects(async () => parseOutlookIntakeEnvelope({ ...input, hasAttachments: false }));
await assert.rejects(async () => parseOutlookIntakeEnvelope({ ...input, accessToken: "forbidden" }));
console.log("outlook intake envelope behavior: PASS");
