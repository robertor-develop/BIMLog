import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveLensNextLaunchProject } from "./lens-next-launch-binding.ts";
import type { LensNextBridgeProjectContext } from "./lens-next-types.ts";

const projects = [
  { id: 26, name: "ELARA EAST", code: "ELA01" },
  { id: 29, name: "Authorized second project", code: "P29" },
];
const unbound: LensNextBridgeProjectContext = {
  sessionId: "session",
  projectId: null,
  modelFingerprint: "a".repeat(64),
  modelBindingKey: "1185-river-av-model-06-11-26",
  displayName: "1185 RIVER AV MODEL-06-11-26.nwd",
  bindingSource: "unbound",
  managedViewpointCount: 0,
};

const explicit = resolveLensNextLaunchProject(projects, null, unbound, "navisworks");
assert.equal(explicit.status, "unbound_project");
assert.equal(explicit.projectId, null);
assert.equal(explicit.locked, false);

const retainedSelection = resolveLensNextLaunchProject(projects, 29, unbound, "navisworks");
assert.equal(retainedSelection.status, "unbound_project");
assert.equal(retainedSelection.projectId, 29);

const bound = resolveLensNextLaunchProject(projects, null, { ...unbound, projectId: 26, bindingSource: "managed-marker" }, "navisworks");
assert.equal(bound.status, "bound");
assert.equal(bound.projectId, 26);
assert.equal(bound.locked, true);

const unauthorized = resolveLensNextLaunchProject(projects, null, { ...unbound, projectId: 30, bindingSource: "managed-marker" }, "navisworks");
assert.equal(unauthorized.status, "unauthorized_project");
assert.equal(unauthorized.projectId, null);

const workspace = readFileSync(new URL("./LensNextWorkspace.tsx", import.meta.url), "utf8");
assert.match(workspace, /resolveModelBinding\(context\.modelBindingKey, context\.displayName, null, null, controller\.signal\)/);
assert.doesNotMatch(workspace, /inventory\.viewpoints\.map\(\(view\) => view\.projectId\)/);

console.log("PASS Lens Next unbound and authoritative launch binding behavior");
