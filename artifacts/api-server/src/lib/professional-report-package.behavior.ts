import assert from "node:assert/strict";
import { createReportPackageManifest, transitionReportPackage } from "./professional-report-package";

const generated = createReportPackageManifest({ id: "pkg-1", tenantId: 31, projectId: 26, sourceVersions: [{ sourceKey: "rfi:9", version: 3 }], artifacts: [{ format: "pdf", sha256: "a".repeat(64), bytes: 1200 }, { format: "xlsx", sha256: "b".repeat(64), bytes: 900 }] });
assert.equal(generated.state, "generated", "generation must not imply delivery");
assert.throws(() => transitionReportPackage(generated, "delivered", { actorUserId: 7, occurredAt: "2026-09-28T15:00:00Z" }), /REPORT_PACKAGE_DELIVERY_REQUIRES_APPROVAL/);
const approved = transitionReportPackage(generated, "approved", { actorUserId: 8, occurredAt: "2026-09-28T15:00:00Z" });
const delivered = transitionReportPackage(approved, "delivered", { actorUserId: 7, occurredAt: "2026-09-28T15:05:00Z" });
assert.equal(delivered.state, "delivered");
assert.equal(delivered.approvedByUserId, 8);
assert.deepEqual(delivered.sourceVersions, [{ sourceKey: "rfi:9", version: 3 }]);
console.log("C049 governed report package lifecycle and manifest: PASS");
