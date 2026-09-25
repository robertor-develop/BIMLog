import assert from "node:assert/strict";
import { FolderWizardGraphUpload } from "./folder-wizard-graph-upload";

let request: { url: string; init: RequestInit } | null = null;
const lease = { withBearerToken: async (_scope: unknown, work: (token: Uint8Array) => Promise<unknown>) => work(Buffer.from("synthetic-token-long")) };
const input = { companyId: 2, credentialId: "credential-1", driveId: "drive-1", driveRelativePath: "SHOP/proof.txt", filename: "proof.txt", bytes: Buffer.from("proof") };
const uploader = new FolderWizardGraphUpload(lease as never, async (url, init) => {
  request = { url: String(url), init: init! };
  if (init?.method === "POST") {
    assert.match(String(url), /createUploadSession$/);
    assert.match(String(init.body), /"@microsoft.graph.conflictBehavior":"fail"/);
    return new Response(JSON.stringify({ uploadUrl: "https://sn3302.up.1drv.com/up/synthetic-session" }), { status: 200 });
  }
  return new Response(JSON.stringify({ id: "item-1", name: "proof.txt", size: 5,
    webUrl: "https://bimtech.sharepoint.com/sites/QA/Shared%20Documents/SHOP/proof.txt", parentReference: { driveId: "drive-1" } }), { status: 201 });
});
assert.deepEqual(await uploader.create(input), { itemId: "item-1", webUrl: "https://bimtech.sharepoint.com/sites/QA/Shared%20Documents/SHOP/proof.txt" });
assert.match(request!.url, /sn3302\.up\.1drv\.com\/up\/synthetic-session/);
assert.equal((request!.init.headers as Record<string, string>)["authorization"], undefined);
assert.equal((request!.init.headers as Record<string, string>)["content-range"], "bytes 0-4/5");
assert.equal(request!.init.redirect, "error");
await assert.rejects(uploader.create({ ...input, driveRelativePath: "../proof.txt" }), /UPLOAD_INVALID/);
const metadata = { id: "item-1", name: "proof.txt", size: 5,
  webUrl: "https://bimtech.sharepoint.com/sites/QA/Shared%20Documents/SHOP/proof.txt",
  parentReference: { driveId: "drive-1" } };
const conflict = new FolderWizardGraphUpload(lease as never, async (url, init) => {
  if (init?.method === "POST") return new Response("", { status: 412 });
  if (String(url).includes("?$select=")) return new Response(JSON.stringify(metadata), { status: 200 });
  if (String(url).endsWith("/content")) return new Response("", { status: 302,
    headers: { location: "https://bimtech.sharepoint.com/download?token=synthetic" } });
  assert.equal(init?.headers, undefined, "No bearer token may reach a preauthenticated download URL");
  return new Response("proof", { status: 200 });
});
assert.deepEqual(await conflict.create(input), { itemId: "item-1", webUrl: metadata.webUrl });
const different = new FolderWizardGraphUpload(lease as never, async (url, init) => {
  if (init?.method === "POST") return new Response("", { status: 409 });
  if (String(url).includes("?$select=")) return new Response(JSON.stringify(metadata), { status: 200 });
  if (String(url).endsWith("/content")) return new Response("wrong", { status: 200 });
  throw new Error("Unexpected request");
});
await assert.rejects(different.create(input), /GRAPH_FILE_CONFLICT/);
const unsafe = new FolderWizardGraphUpload(lease as never, async (url, init) => {
  if (init?.method === "POST") return new Response("", { status: 412 });
  if (String(url).includes("?$select=")) return new Response(JSON.stringify(metadata), { status: 200 });
  return new Response("", { status: 302, headers: { location: "https://evil.example/download" } });
});
await assert.rejects(unsafe.create(input), /GRAPH_CONFLICT_UNRESOLVED/);
const uploadConflict = new FolderWizardGraphUpload(lease as never, async (url, init) => {
  if (init?.method === "POST") return new Response(JSON.stringify({ uploadUrl: "https://sn3302.up.1drv.com/up/synthetic-session" }), { status: 200 });
  if (init?.method === "PUT") return new Response("", { status: 409 });
  if (String(url).includes("?$select=")) return new Response(JSON.stringify(metadata), { status: 200 });
  if (String(url).endsWith("/content")) return new Response("proof", { status: 200 });
  throw new Error("Unexpected request");
});
assert.deepEqual(await uploadConflict.create(input), { itemId: "item-1", webUrl: metadata.webUrl });
const maliciousSession = new FolderWizardGraphUpload(lease as never, async (_url, init) => {
  assert.equal(init?.method, "POST", "An unapproved upload URL must never receive file bytes");
  return new Response(JSON.stringify({ uploadUrl: "https://evil.example/upload" }), { status: 200 });
});
await assert.rejects(maliciousSession.create(input), /UPLOAD_SESSION_INVALID/);
console.log("Folder Wizard Graph create-only upload: PASS");
