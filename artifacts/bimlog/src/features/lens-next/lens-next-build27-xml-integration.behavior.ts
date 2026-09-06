import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createLensNextBridgeClient } from "./lens-next-client.ts";
import type { LensNextBridgeProjectContext, LensNextIssue } from "./lens-next-types.ts";

const root = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(root, "LensNextPanel.tsx"), "utf8");
const view = readFileSync(join(root, "LensNextPanelView.tsx"), "utf8");
const client = readFileSync(join(root, "lens-next-client.ts"), "utf8");

assert.match(view, /data-lens-next-action="export-viewpoints-xml"/);
assert.match(view, /"Export Viewpoints XML"/);
assert.match(panel, /bridgeContext\.projectId !== authorizedProjectId/);
assert.match(panel, /issue\.identity\.projectId === authorizedProjectId/);
assert.match(panel, /apiClient\.loadVisualState\(issue\)/);
assert.match(panel, /bridgeClient\.exportViewpointsXml\(candidates, new Map\(loaded\), bridgeContext\)/);
assert.match(panel, /result\.cancelled[\s\S]*No destination file was written/);
assert.match(panel, /PARTIAL_SUCCESS[\s\S]*serialized[\s\S]*skipped/);
assert.match(panel, /summary\.exportResult === "FAIL"/);
assert.match(client, /Cross-project XML export is forbidden/);
assert.match(client, /command: "export-viewpoints-xml"/);
assert.doesNotMatch(client.slice(client.indexOf("async exportViewpointsXml"), client.indexOf("async captureLocalViewpoint")), /createLocalSavedViewpoint|applyPlatformWorkingView/);

const requests: Array<Record<string, unknown>> = [];
const fetchImpl: typeof fetch = async (_input, init) => {
  requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
  return new Response(JSON.stringify({ success: true, code: "xml_export_result", payload: {
    Cancelled: false,
    Summary: { RequestedCount: 2, SerializedCount: 1, SkippedCount: 1, OutputPath: "F:\\evidence\\viewpoints.xml", OutputWritten: true, ValidationResult: "PASS", ExportResult: "PARTIAL_SUCCESS", FailureDetail: null },
    Diagnostics: [{ ServerId: 160, ViewpointId: "vp-160", DisplayId: "VP-160", Result: "EXPORTED", ReasonCode: "exported", ReasonDetail: null }, { ServerId: 161, ViewpointId: "vp-161", DisplayId: "VP-161", Result: "SKIPPED", ReasonCode: "invalid_rotation", ReasonDetail: "zero quaternion" }],
  } }), { status: 200, headers: { "Content-Type": "application/json" } });
};
const context: LensNextBridgeProjectContext = { sessionId: "session", projectId: 26, modelFingerprint: "a".repeat(64), modelBindingKey: "binding", displayName: "controlled.nwd", bindingSource: "managed-marker", managedViewpointCount: 0 };
const issue = (serverId: number): LensNextIssue => ({ identity: { projectId: 26, serverId, viewpointId: `vp-${serverId}`, lifecycleStatus: "active", revisionNumber: 1 }, mutationVersion: 1, publishingAllowed: false, displayId: `VP-${serverId}`, navisworksGuid: null, bimlogPhysicalId: null, issueGroupId: null, note: null, openItems: null, trade: null, floor: null, responsibleCompany: null, reportType: null, priority: 1, status: "open", capturedAt: null, syncedAt: null, supersedesId: null, supersedesCode: null, screenshotUrl: null, visualStateAvailable: true, visualStateDigest: "b".repeat(64) });
const packageJson = JSON.stringify({ ProjectId: 26, ServerId: 160, ViewpointId: "vp-160", LifecycleStatus: "active", RevisionNumber: 1, Camera: {}, SectioningJson: null, DigestSha256: "b".repeat(64) });
const bridge = createLensNextBridgeClient({ sessionToken: "token", bridgeOrigin: "http://127.0.0.1:8766", fetchImpl, requestIdFactory: () => "build27-request" });
const result = await bridge.exportViewpointsXml([issue(160), issue(161)], new Map([[160, { visualStateJson: packageJson, visualStateDigest: "b".repeat(64) }], [161, { visualStateJson: packageJson.replaceAll("160", "161"), visualStateDigest: "b".repeat(64) }]]), context);
assert.equal(result.summary?.exportResult, "PARTIAL_SUCCESS");
assert.equal(result.diagnostics[1]?.reasonCode, "invalid_rotation");
const fields = (requests[0]?.fields ?? {}) as Record<string, unknown>;
assert.equal(fields.projectId, "26");
assert.equal(fields.modelFingerprint, "a".repeat(64));
assert.doesNotMatch(String(fields.recordsJson), /ScreenshotDataUrl|SavedViewpoints/);

console.log("PASS Build 27 authoritative XML product integration contract");
