import assert from "node:assert/strict";
import { activeLensNextIssues } from "./lens-next-model";

const row = (serverId: number, lifecycleStatus: "active" | "superseded" | "void") => ({
  identity: { projectId: 26, serverId, viewpointId: `view-${serverId}`, lifecycleStatus, revisionNumber: serverId },
} as any);

const fullHistory = [row(1, "superseded"), row(2, "active"), row(3, "void"), row(4, "active")];
assert.deepEqual(activeLensNextIssues(fullHistory).map(item => item.identity.serverId), [2, 4]);
assert.equal(fullHistory.length, 4, "filtering must not mutate or erase revision history");

console.log("Lens Next active operational list with preserved history: PASS");
