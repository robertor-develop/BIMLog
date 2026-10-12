import assert from "node:assert/strict";
import { inspectSmtpEndpoint, smtpAuthPlain, smtpDotStuff, smtpReplyCode, smtpReplyComplete } from "./launch-smtp-probe";

const endpoint = inspectSmtpEndpoint({ provider: "smtp", senderAddress: "Launch@Example.test", smtpHost: "smtp.example.test", smtpPort: 587, smtpUsername: "synthetic" });
assert.deepEqual(endpoint, { host: "smtp.example.test", port: 587, username: "synthetic", sender: "launch@example.test", implicitTls: false });
assert.equal(inspectSmtpEndpoint({ provider: "smtp", senderAddress: "x@example.test", smtpHost: "bad host", smtpPort: 25, smtpUsername: "x" }), null);
assert.equal(smtpAuthPlain("u", "p"), Buffer.from("\0u\0p").toString("base64"));
assert.equal(smtpDotStuff("one\n.two"), "one\r\n..two");
assert.equal(smtpDotStuff(".first\r\n..second"), "..first\r\n...second");
assert.equal(smtpReplyComplete("250-first\r\n250 ok\r\n"), true);
assert.equal(smtpReplyComplete("250-first\r\n"), false);
assert.equal(smtpReplyCode("535 rejected\r\n"), 535);
console.log("launch SMTP protocol contract: PASS");
