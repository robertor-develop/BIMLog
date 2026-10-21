import assert from "node:assert/strict";
import { reconcileNavigationGroups, toggleNavigationGroup } from "./project-navigation.ts";

assert.deepEqual(reconcileNavigationGroups(["command", "documents"], "documents", { command: false }), { command: false, documents: true });
assert.deepEqual(toggleNavigationGroup({ command: true, documents: true }, "documents", "documents"), { command: true, documents: true });
assert.deepEqual(toggleNavigationGroup({ command: true, documents: true }, "command", "documents"), { command: false, documents: true });
console.log("PROJECT_NAVIGATION_RESULT=PASS active location remains reachable while groups collapse");
