import assert from "node:assert/strict";
import { parseSharePointPublicationConfirmation } from "./sharepoint-publication-confirmation";
const digest = "a".repeat(64);
assert.deepEqual(parseSharePointPublicationConfirmation({ fileId: 7, requestDigest: digest, confirmation: "publish_sharepoint" }),
  { fileId: 7, requestDigest: digest, confirmation: "publish_sharepoint" });
for (const bad of [{ fileId: 0, requestDigest: digest, confirmation: "publish_sharepoint" },
  { fileId: 7, requestDigest: "bad", confirmation: "publish_sharepoint" },
  { fileId: 7, requestDigest: digest, confirmation: "yes" }])
  assert.throws(() => parseSharePointPublicationConfirmation(bad), /CONFIRMATION_REQUIRED/);
