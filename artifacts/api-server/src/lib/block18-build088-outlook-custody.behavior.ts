import assert from "node:assert/strict";
import { mapOutlookCustody } from "./block18-build088-outlook-custody";

const envelope = { provider: "microsoft_graph", mailboxCredentialId: "mailbox-1", internetMessageId: "message@example", providerMessageId: "provider-1", conversationId: "thread-1", receivedAt: "2026-09-20T12:00:00Z", sender: "sender@example.com", recipients: ["team@example.com"], subject: "RFI response", bodyPreview: "Controlled intake", hasAttachments: true, attachmentRefs: [{ providerAttachmentId: "attachment-1", name: "response.pdf", byteSize: 42 }] } as const;
const mapped = mapOutlookCustody(envelope, 9, 26, null);
assert.equal(mapped.outcome, "mapped");
assert.equal(mapOutlookCustody(envelope, 9, 26, mapped.mapping).outcome, "replay");
assert.throws(() => mapOutlookCustody(envelope, 10, 26, mapped.mapping), /CROSS_TENANT/);
assert.throws(() => mapOutlookCustody(envelope, 9, 27, mapped.mapping), /CROSS_TENANT/);
assert.throws(() => mapOutlookCustody({ ...envelope, conversationId: "thread-2" }, 9, 26, mapped.mapping), /MESSAGE_IDENTITY_CONFLICT/);
assert.throws(() => mapOutlookCustody({ ...envelope, subject: "Changed after intake" }, 9, 26, mapped.mapping), /DIVERGENT_REPLAY/);
assert.throws(() => mapOutlookCustody({ ...envelope, attachmentRefs: [], hasAttachments: true }, 9, 26, null));
assert.equal(JSON.stringify(mapped).includes("accessToken"), false);
console.log("block18 build088 outlook custody: PASS");
