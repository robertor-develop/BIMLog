import assert from "node:assert/strict";
import { loadExportableLensNextPackages, lensNextXmlSkippedSummary } from "./lens-next-xml-export-selection";

const issue = (serverId: number, displayId: string) => ({
  identity: { projectId: 26, serverId, viewpointId: `view-${serverId}`, lifecycleStatus: "active", revisionNumber: 1 },
  displayId,
} as any);

const current = issue(10, "FI-010");
const historical = issue(11, "FI-011");
const anotherCurrent = issue(12, "FI-012");
const loaded = await loadExportableLensNextPackages(
  [current, historical, anotherCurrent],
  async candidate => {
    if (candidate.identity.serverId === 11) throw new Error("historical digest evidence unavailable");
    return { visualStateJson: `{\"ServerId\":${candidate.identity.serverId}}`, visualStateDigest: "a".repeat(64) };
  },
);

assert.deepEqual(loaded.exportable.map(candidate => candidate.identity.serverId), [10, 12]);
assert.equal(loaded.packages.size, 2);
assert.equal(loaded.skipped.length, 1);
assert.match(lensNextXmlSkippedSummary(loaded.skipped), /FI-011: historical digest evidence unavailable/);

const none = await loadExportableLensNextPackages([historical], async () => { throw new Error("quarantined"); });
assert.equal(none.exportable.length, 0);
assert.equal(none.packages.size, 0);
assert.equal(none.skipped.length, 1);

console.log("Lens Next XML export per-viewpoint isolation: PASS");
