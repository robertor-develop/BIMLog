import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createLensNextApiClient } from "./lens-next-client";

const identity = { projectId: 41, serverId: 73, viewpointId: "vp-combined", lifecycleStatus: "active" as const, revisionNumber: 1 };
const eligible = [
  { type: "rfi", authoritativeId: 101, displayId: "RFI-042", title: "Coordination conflict" },
  { type: "submittal", authoritativeId: 202, displayId: "SUB-018", title: "Curtain wall sample" },
];
let links: Array<Record<string, unknown>> = [], attachments: Array<Record<string, unknown>> = [];
const methods: string[] = [];
const client = createLensNextApiClient({ token: "build30-token", apiBaseUrl: "/api/v1", fetchImpl: async (input, init) => {
  const url = String(input), method = init?.method ?? "GET"; methods.push(`${method} ${url}`);
  if (url.endsWith("/download")) return new Response(new Blob(["%PDF-proof"]), { status: 200 });
  if (url.endsWith("/links") && method === "POST") {
    const body = JSON.parse(String(init?.body)); const candidate = eligible.find(item => item.type === body.targetType && item.authoritativeId === body.targetId)!;
    links = [...links, { linkId: links.length + 1, ...candidate }];
  } else if (url.includes("/links/") && method === "DELETE") links = links.filter(item => item.linkId !== Number(url.split("/").pop()));
  if (url.endsWith("/attachments") && method === "POST") attachments = [{ linkId: 3, fileId: 303, fileName: "reference.pdf", fileSize: 10, mimeType: "application/pdf", createdAt: "2026-09-07T12:00:00Z", downloadUrl: "/api/v1/projects/41/files/303/download" }];
  else if (url.includes("/attachments/") && method === "DELETE") attachments = [];
  return new Response(JSON.stringify(url.includes("attachments") ? { success: true, attachments } : { success: true, links, eligible }), { status: method === "POST" ? 201 : 200, headers: { "content-type": "application/json" } });
} });

await client.linkBimlogItem(identity, "rfi", 101);
await client.linkBimlogItem(identity, "submittal", 202);
const uploaded = await client.uploadReferenceAttachment(identity, new File(["%PDF-proof"], "reference.pdf", { type: "application/pdf" }));
assert.deepEqual((await client.loadLinkedItems(identity)).links.map(item => item.type), ["rfi", "submittal"]);
assert.equal((await client.loadReferenceAttachments(identity)).attachments.length, 1);
assert.equal((await client.downloadReferenceAttachment(uploaded.attachments[0])).size, 10);
await client.removeReferenceAttachment(identity, 3);
assert.deepEqual((await client.loadLinkedItems(identity)).links.map(item => item.type), ["rfi", "submittal"], "attachment removal must preserve BIMLog item links");
await client.removeLinkedItem(identity, 1);
assert.equal((await client.loadLinkedItems(identity)).links[0].type, "submittal", "RFI removal must preserve Submittal");
assert.equal((await client.loadReferenceAttachments(identity)).attachments.length, 0);
assert.ok(methods.every(value => value.includes("/projects/41/")));

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const route = readFileSync(`${root}/api-server/src/routes/clash_reports.ts`, "utf8");
const constants = readFileSync(`${root}/../plugins/BIMLogLensNext/src/LensNextConstants.cs`, "utf8");
const attachmentStart = route.indexOf("const lensReferenceUpload"), integrationEnd = route.indexOf("// Registered BEFORE", attachmentStart), integration = route.slice(attachmentStart, integrationEnd);
assert.doesNotMatch(integration, /visualState|visualStateDigest|Camera|Xml|Saved Viewpoint/);
assert.doesNotMatch(integration, /update\((rfisTable|submittalsTable|lensViewpointsTable)\)/);
assert.match(integration, /eq\(lensViewpointsTable\.projectId, projectId\)/);
assert.match(integration, /eq\(filesTable\.projectId, projectId\)/);
assert.match(integration, /requirePermission\("admin", "write"\)/);
assert.match(constants, /BridgeMinimumPort = 8766/);
assert.match(constants, /BridgePort = BridgeMinimumPort/);
assert.match(constants, /ProductVersionLabel = "v1\.05\.N12-P08"/);
console.log("BUILD30_RELEASE_CANDIDATE_JOURNEY=PASS combined=viewpoint+rfi+submittal+attachment isolation=project,authorization,camera,digest,xml,saved-viewpoint");
