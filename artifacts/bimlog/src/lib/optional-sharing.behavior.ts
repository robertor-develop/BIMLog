import assert from "node:assert/strict";
import { buildEmailComposeUrl, emailAttachmentGuidance, optionalSharingChoices } from "./optional-sharing";

const draft = {
  recipients: ["REVIEWER@example.com", "reviewer@example.com", "pm@example.com"],
  subject: "BIMLog RFI QA-001",
  body: "Please review the attached controlled package.",
  downloadUrl: "https://bimlog.app/api/v1/delivery/example",
};

for (const provider of ["default", "gmail", "outlook", "yahoo"] as const) {
  const url = buildEmailComposeUrl(provider, draft);
  assert.match(url, /reviewer%40example\.com/);
  assert.match(url, /pm%40example\.com/);
  assert.equal((url.match(/reviewer%40example\.com/g) ?? []).length, 1);
  assert.match(url, /BIMLog%20RFI%20QA-001/);
  assert.match(url, /BIMLog%20package%3A%20https%3A%2F%2Fbimlog\.app/);
}

assert.match(emailAttachmentGuidance("en"), /does not allow a website to attach/i);
assert.match(emailAttachmentGuidance("es"), /no permite que un sitio web adjunte/i);
assert.deepEqual(optionalSharingChoices("en"), [
  "Send by Telegram",
  "Prepare email",
  "Download package",
  "Copy secure link",
  "Do not send now",
]);

console.log("PASS optional sharing contract");
