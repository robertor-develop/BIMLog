import assert from "node:assert/strict";
import { connectorMatrixStatus, documentedConnectorMatrix } from "./block18-build089-connector-matrix";

const active = { configured: true, approved: true, credentialState: "active" } as const;
assert.equal(connectorMatrixStatus({ provider: "google_drive", ...active }).state, "available");
assert.equal(connectorMatrixStatus({ provider: "dropbox", ...active }).state, "available");
assert.equal(connectorMatrixStatus({ provider: "google_drive", ...active, credentialState: "expired" }).state, "credential_expired");
assert.equal(connectorMatrixStatus({ provider: "dropbox", ...active, credentialState: "revoked" }).state, "credential_revoked");
assert.equal(connectorMatrixStatus({ provider: "sharepoint", ...active, approved: false }).state, "approval_required");
assert.equal(connectorMatrixStatus({ provider: "google_drive", ...active, configured: false }).state, "setup_required");
assert.equal(connectorMatrixStatus({ provider: "invented_provider", ...active }).state, "unsupported");
const matrix = documentedConnectorMatrix([
  { provider: "dropbox", ...active },
  { provider: "google_drive", ...active, credentialState: "expired" },
]);
assert.deepEqual(matrix.map((item) => item.provider), ["dropbox", "google_drive"]);
assert.equal(JSON.stringify(matrix).includes("token"), false);
assert.equal(JSON.stringify(matrix).includes("secret"), false);
console.log("block18 build089 connector matrix: PASS");
