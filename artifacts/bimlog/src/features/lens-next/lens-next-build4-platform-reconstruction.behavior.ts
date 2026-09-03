import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const workingView = readFileSync(new URL("./lens-next-working-view.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("./lens-next-client.ts", import.meta.url), "utf8");
const native = readFileSync(new URL("../../../../../plugins/BIMLogLensNext/native/AutodeskVisualStateAdapter.cs", import.meta.url), "utf8");

assert.match(panel, /openBimlogWorkingView/);
assert.match(workingView, /!issue\.visualStateAvailable \|\| !issue\.visualStateDigest/);
const openFunction = workingView.slice(
  workingView.indexOf("export async function openBimlogWorkingView"),
  workingView.indexOf("export async function repairBimlogWorkingViewFromCurrent"),
);
assert.doesNotMatch(openFunction, /bridgeClient\.openWorkingView|captureCurrentVisualState|saveVisualState/);
assert.match(openFunction, /apiClient\.loadVisualState\(issue, signal\)/);
assert.match(openFunction, /bridgeClient\.applyPlatformWorkingView\(issue, context, stored\.visualStateJson, stored\.visualStateDigest, signal\)/);
assert.match(workingView, /bridgeClient\.captureCurrentVisualState\(issue, context, signal\)/);
assert.match(workingView, /apiClient\.saveVisualState\(issue, captured\.visualStateJson, captured\.visualStateDigest, signal\)/);
assert.match(workingView, /apiClient\.loadVisualState\(migratedIssue, signal\)/);
assert.match(workingView, /bridgeClient\.applyPlatformWorkingView\(migratedIssue, context, stored\.visualStateJson, stored\.visualStateDigest, signal\)/);
assert.match(client, /visual-state digest changed after inventory refresh/);
assert.match(client, /visual-state package digest is inconsistent/);
assert.match(native, /Temporary BIMLog working view reconstructed without creating a SavedViewpoint/);
assert.match(native, /Visual-state digest validation failed/);
for (const component of ["ApplyCamera(state.Camera)", "ApplySelection(state.SelectedElements, resolution)", "ApplyVisibility(state.HiddenElements, resolution)", "ApplyAppearance(state.AppearanceOverrides, resolution)", "InvokeSectioningSetter(state.SectioningJson)"])
  assert.ok(native.includes(component), `direct working view must restore ${component}`);
assert.match(native, /ResolveExact\(AllElementReferences\(state\), true, resolution\)/);
assert.match(native, /state\.ModelReferences = scan\.Models/);
assert.match(native, /different model fingerprint/);
console.log("PASS Lens Next Build 4 governed BIMLog-to-Navisworks reconstruction boundary");
