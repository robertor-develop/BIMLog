import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createLensNextApiClient } from "./lens-next-client";
import { LENS_REFERENCE_MAX_BYTES, validateLensReferenceFile } from "../../../../api-server/src/lib/lens-next-reference-attachment";

const validate = (originalname: string, mimetype: string, buffer: Buffer, size = buffer.length) => validateLensReferenceFile({ originalname, mimetype, buffer, size });
assert.equal(validate("safe.pdf", "application/pdf", Buffer.from("%PDF-test")).mimeType, "application/pdf");
assert.equal(validate("safe.png", "image/png", Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])).mimeType, "image/png");
assert.equal(validate("safe.jpg", "image/jpeg", Buffer.from([0xff,0xd8,0xff,0x00,0xff,0xd9])).mimeType, "image/jpeg");
assert.equal(validate("C:\\fakepath\\safe.pdf", "application/pdf", Buffer.from("%PDF-test")).fileName, "safe.pdf");
assert.doesNotThrow(() => validate("limit.pdf", "application/pdf", Buffer.from("%PDF-test"), LENS_REFERENCE_MAX_BYTES));
assert.throws(() => validate("large.pdf", "application/pdf", Buffer.from("%PDF-test"), LENS_REFERENCE_MAX_BYTES + 1), /5 MB/);
assert.throws(() => validate("script.exe", "application/octet-stream", Buffer.from("MZ")), /Only PDF/);
assert.throws(() => validate("fake.pdf", "application/pdf", Buffer.from("MZ")), /does not match/);

const identity = { projectId: 41, serverId: 73, viewpointId: "vp-authoritative", lifecycleStatus: "active" as const, revisionNumber: 1 };
const attachment = { linkId: 19, fileId: 29, fileName: "reference.pdf", fileSize: 12, mimeType: "application/pdf" as const, createdAt: "2026-09-07T12:00:00.000Z", downloadUrl: "/api/v1/projects/41/files/29/download" };
const calls: Array<{ url: string; method: string; authorization: string | null; body: BodyInit | null }> = [];
const client = createLensNextApiClient({ token: "build29-token", apiBaseUrl: "/api/v1", fetchImpl: async (input, init) => {
  calls.push({ url: String(input), method: init?.method ?? "GET", authorization: new Headers(init?.headers).get("authorization"), body: init?.body ?? null });
  if (String(input).endsWith("/download")) return new Response(new Blob(["%PDF-test"]), { status: 200, headers: { "content-type": "application/pdf" } });
  return new Response(JSON.stringify({ success: true, attachments: [attachment] }), { status: init?.method === "POST" ? 201 : 200, headers: { "content-type": "application/json" } });
} });

assert.equal((await client.loadReferenceAttachments(identity)).attachments[0].fileName, "reference.pdf");
await client.uploadReferenceAttachment(identity, new File(["%PDF-test"], "reference.pdf", { type: "application/pdf" }));
await client.removeReferenceAttachment(identity, 19);
assert.equal((await client.downloadReferenceAttachment(attachment)).size, 9);
assert.deepEqual(calls.map(call => [call.method, call.url]), [
  ["GET", "/api/v1/projects/41/clash-reports/lens-next/issues/73/attachments"],
  ["POST", "/api/v1/projects/41/clash-reports/lens-next/issues/73/attachments"],
  ["DELETE", "/api/v1/projects/41/clash-reports/lens-next/issues/73/attachments/19"],
  ["GET", "/api/v1/projects/41/files/29/download"],
]);
assert.ok(calls[1].body instanceof FormData);
assert.ok(calls.every(call => call.authorization === "Bearer build29-token"));
await assert.rejects(() => client.removeReferenceAttachment(identity, 0), /identity is invalid/);

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const route = readFileSync(`${root}/api-server/src/routes/clash_reports.ts`, "utf8");
const files = readFileSync(`${root}/api-server/src/routes/files.ts`, "utf8");
const view = readFileSync(`${root}/bimlog/src/features/lens-next/LensNextPanelView.tsx`, "utf8");
const attachmentScope = route.slice(route.indexOf("const lensReferenceUpload"), route.indexOf("// Registered BEFORE", route.indexOf("const lensReferenceUpload")));
assert.match(attachmentScope, /singleFileUpload\(\{ fileSize: LENS_REFERENCE_MAX_BYTES/);
assert.match(attachmentScope, /eq\(lensViewpointsTable\.projectId, projectId\)/);
assert.match(attachmentScope, /eq\(filesTable\.projectId, projectId\)/);
assert.match(attachmentScope, /requirePermission\("admin", "write"\)/);
assert.match(attachmentScope, /storage\.upload/);
assert.match(attachmentScope, /if \(storagePath\) try \{ await storage\.delete\(storagePath\)/);
assert.match(attachmentScope, /remaining\.length/);
assert.doesNotMatch(attachmentScope, /update\((rfisTable|submittalsTable|lensViewpointsTable)\)/);
assert.match(files, /files\/:fileId\/download[\s\S]*requireProjectMember\(\)/);
assert.match(view, /Reference Attachments/);
assert.match(view, /max 5 MB/);
assert.match(view, /Open\/Download/);
console.log("BUILD29_ATTACHMENTS_FOCUSED=PASS cases=pdf-image-policy,5mb-server-limit,magic-signatures,project-scope,write-auth,persist-list,authenticated-download,orphan-safe-delete,compensation,client-ui");
