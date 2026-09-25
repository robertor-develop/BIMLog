import assert from "node:assert/strict";
import { FolderWizardGraphIdentity } from "./folder-wizard-graph-identity";

const token = new TextEncoder().encode("synthetic-test-bearer-token");
const urls: string[] = [];
let driveUrl = "https://bimtech.sharepoint.com/sites/QA/Shared%20Documents";
const transport = async (url: string, init: RequestInit) => {
  urls.push(url);
  assert.equal(init.method, "GET");
  assert.equal(init.redirect, "error");
  return new Response(JSON.stringify(url.includes("/sites/")
    ? { id: "site-1", webUrl: "https://bimtech.sharepoint.com/sites/QA" }
    : { id: "drive-1", webUrl: driveUrl, driveType: "documentLibrary" }), { status: 200 });
};
const lease = { async withBearerToken<T>(_scope: unknown, operation: (value: Uint8Array) => Promise<T>) {
  return operation(token);
} };
const service = new FolderWizardGraphIdentity(lease as never, transport as typeof fetch);
const input = { companyId: 2, credentialId: "credential-1", siteId: "site-1", libraryId: "drive-1" };
assert.deepEqual(await service.verify(input), { siteUrl: "https://bimtech.sharepoint.com/sites/QA", libraryId: "drive-1" });
assert.ok(token.every((byte) => byte === 0));
assert.equal(urls.length, 2);
driveUrl = "https://other.sharepoint.com/sites/QA/Shared";
const invalid = new FolderWizardGraphIdentity({ async withBearerToken<T>(_scope: unknown, operation: (value: Uint8Array) => Promise<T>) {
  return operation(new Uint8Array([1]));
} } as never, transport as typeof fetch);
await assert.rejects(() => invalid.verify(input), /FOLDER_WIZARD_GRAPH_CREDENTIAL_INVALID/);
const other = new FolderWizardGraphIdentity({ async withBearerToken<T>(_scope: unknown, operation: (value: Uint8Array) => Promise<T>) {
  return operation(new TextEncoder().encode("synthetic-test-bearer-token"));
} } as never, transport as typeof fetch);
await assert.rejects(() => other.verify(input), /FOLDER_WIZARD_GRAPH_LIBRARY_MISMATCH/);
console.log("Folder Wizard protected Graph identity: PASS");
