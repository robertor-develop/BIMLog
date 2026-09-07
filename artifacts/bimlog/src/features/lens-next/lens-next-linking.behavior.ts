import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createLensNextApiClient } from "./lens-next-client";

const identity = { projectId: 41, serverId: 73, viewpointId: "vp-authoritative", lifecycleStatus: "active" as const, revisionNumber: 1 };
const calls: Array<{ url: string; method: string; body: unknown }> = [];
const response = { success: true, links: [{ linkId: 9, type: "rfi", authoritativeId: 101, displayId: "RFI-042", title: "Coordination conflict" }], eligible: [{ type: "submittal", authoritativeId: 202, displayId: "SUB-018", title: "Curtain wall sample" }] };
const client = createLensNextApiClient({ token: "build28-token", apiBaseUrl: "/api/v1", fetchImpl: async (input, init) => {
  calls.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
  return new Response(JSON.stringify(response), { status: init?.method === "POST" ? 201 : 200, headers: { "content-type": "application/json" } });
} });

const loaded = await client.loadLinkedItems(identity);
assert.equal(loaded.links[0].displayId, "RFI-042");
await client.linkBimlogItem(identity, "submittal", 202);
await client.removeLinkedItem(identity, 9);
assert.deepEqual(calls.map(call => [call.method, call.url]), [
  ["GET", "/api/v1/projects/41/clash-reports/lens-next/issues/73/links"],
  ["POST", "/api/v1/projects/41/clash-reports/lens-next/issues/73/links"],
  ["DELETE", "/api/v1/projects/41/clash-reports/lens-next/issues/73/links/9"],
]);
assert.deepEqual(calls[1].body, { targetType: "submittal", targetId: 202 });
await assert.rejects(() => client.linkBimlogItem(identity, "rfi", 0), /valid authoritative/);

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const route = readFileSync(`${root}/api-server/src/routes/clash_reports.ts`, "utf8");
const view = readFileSync(`${root}/bimlog/src/features/lens-next/LensNextPanelView.tsx`, "utf8");
assert.match(route, /eq\(lensViewpointsTable\.lifecycleStatus, "active"\)/);
assert.match(route, /eq\(rfisTable\.projectId, projectId\).*isNull\(rfisTable\.deletedAt\)/s);
assert.match(route, /eq\(submittalsTable\.projectId, projectId\).*isNull\(submittalsTable\.deletedAt\)/s);
assert.match(route, /for\("update"\)/);
assert.match(route, /code: "duplicate_link"/);
assert.match(route, /requirePermission\("admin", "write"\)/);
assert.doesNotMatch(route.slice(route.indexOf("type LensLinkedItemType"), route.indexOf("\/\/ Registered BEFORE", route.indexOf("type LensLinkedItemType"))), /update\((rfisTable|submittalsTable)\)/);
assert.match(view, /Linked BIMLog Items/);
assert.match(view, /Link BIMLog Item/);
assert.match(view, /onRemoveLinkedItem/);
console.log("BUILD28_LINKING_FOCUSED=PASS cases=client-load-create-remove,authoritative-ids,project-scope,deleted-filter,duplicate-lock,write-auth,no-target-mutation,minimal-ui");
