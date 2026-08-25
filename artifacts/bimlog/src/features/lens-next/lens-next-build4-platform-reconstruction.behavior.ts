import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("./lens-next-client.ts", import.meta.url), "utf8");
const native = readFileSync("H:\\BIMLogPlugin2021\\LensNext-v1.0.08-Pro-M8\\native\\AutodeskVisualStateAdapter.cs", "utf8");

assert.match(panel, /!selectedIssue\.visualStateAvailable \|\| !selectedIssue\.visualStateDigest/);
assert.match(panel, /apiClient\.loadVisualState\(selectedIssue\)/);
assert.match(panel, /bridgeClient\.applyPlatformWorkingView\(selectedIssue, bridgeContext, stored\.visualStateJson\)/);
assert.doesNotMatch(panel, /bridgeClient\.captureCurrentVisualState\(selectedIssue/);
assert.doesNotMatch(panel, /apiClient\.saveVisualState\(/);
assert.match(client, /visual-state digest changed after inventory refresh/);
assert.match(client, /visual-state package digest is inconsistent/);
assert.match(native, /Temporary BIMLog working view reconstructed without creating a SavedViewpoint/);
assert.match(native, /Visual-state digest validation failed/);
console.log("PASS Lens Next Build 4 governed BIMLog-to-Navisworks reconstruction boundary");
