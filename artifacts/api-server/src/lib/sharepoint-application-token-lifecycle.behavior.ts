import assert from "node:assert/strict";
import { SharePointApplicationTokenLifecycle } from "./sharepoint-application-token-lifecycle";

let now = 1_000_000; let issues = 0;
const issuer = { async issue() { issues++; return { token: Uint8Array.from(Buffer.from("application-token-1234567890")), expiresAtMs: now + 120_000 }; } };
const lifecycle = new SharePointApplicationTokenLifecycle(issuer, () => now, 30_000);
const values = await Promise.all(Array.from({ length: 8 }, () => lifecycle.withToken({ companyId: 31, credentialId: "sp-app" }, async token => Buffer.from(token).toString("utf8"))));
assert.equal(issues, 1); assert.equal(new Set(values).size, 1);
now += 100_000;
await lifecycle.withToken({ companyId: 31, credentialId: "sp-app" }, async () => true); assert.equal(issues, 2);
lifecycle.disconnect({ companyId: 31, credentialId: "sp-app" });
await lifecycle.withToken({ companyId: 31, credentialId: "sp-app" }, async () => true); assert.equal(issues, 3);
const restarted = new SharePointApplicationTokenLifecycle(issuer, () => now, 30_000);
await restarted.withToken({ companyId: 31, credentialId: "sp-app" }, async token => { assert.ok(token.byteLength > 16); }); assert.equal(issues, 4);
await assert.rejects(() => lifecycle.withToken({ companyId: 0, credentialId: "sp-app" }, async () => true), /SCOPE_INVALID/);
const bad = new SharePointApplicationTokenLifecycle({ async issue() { return { token: Uint8Array.from(Buffer.from("application-token-1234567890")), expiresAtMs: now + 1 }; } }, () => now, 30_000);
await assert.rejects(() => bad.withToken({ companyId: 31, credentialId: "sp-app" }, async () => true), /LEASE_TOO_SHORT/);
console.log("C096 SharePoint application-token lifecycle: PASS");
