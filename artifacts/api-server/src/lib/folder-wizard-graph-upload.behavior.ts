import assert from "node:assert/strict";
import { FolderWizardGraphUpload } from "./folder-wizard-graph-upload";

let request: { url: string; init: RequestInit } | null = null;
const lease = { withBearerToken: async (_scope: unknown, work: (token: Uint8Array) => Promise<unknown>) => work(Buffer.from("synthetic-token-long")) };
const input = { companyId: 2, credentialId: "credential-1", driveId: "drive-1", driveRelativePath: "SHOP/proof.txt", filename: "proof.txt", bytes: Buffer.from("proof") };
const uploader = new FolderWizardGraphUpload(lease as never, async (url, init) => {
  request = { url: String(url), init: init! };
  return new Response(JSON.stringify({ id: "item-1", name: "proof.txt", size: 5,
    webUrl: "https://bimtech.sharepoint.com/sites/QA/Shared%20Documents/SHOP/proof.txt", parentReference: { driveId: "drive-1" } }), { status: 201 });
});
assert.deepEqual(await uploader.create(input), { itemId: "item-1", webUrl: "https://bimtech.sharepoint.com/sites/QA/Shared%20Documents/SHOP/proof.txt" });
assert.match(request!.url, /graph\.microsoft\.com\/v1\.0\/drives\/drive-1\/root:\/SHOP\/proof\.txt:\/content/);
assert.equal(request!.init.headers && (request!.init.headers as Record<string, string>)["if-none-match"], "*");
assert.equal(request!.init.redirect, "error");
await assert.rejects(uploader.create({ ...input, driveRelativePath: "../proof.txt" }), /UPLOAD_INVALID/);
const conflict = new FolderWizardGraphUpload(lease as never, async () => new Response("", { status: 412 }));
await assert.rejects(conflict.create(input), /FILE_EXISTS/);
console.log("Folder Wizard Graph create-only upload: PASS");
