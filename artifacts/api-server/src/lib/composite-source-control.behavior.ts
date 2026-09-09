import assert from "node:assert/strict";
import { verifyCompositeSourceManifest } from "./composite-source-control";

const component = { discipline: "Mechanical", coordinationFileId: "file-1", revisionId: "rev-2", contentSha256: "a".repeat(64), observedCurrentRevisionId: "rev-2" };
const manifest = { id: "composite-1", projectId: 7, companyId: 3, revisionNumber: 1, components: [component] };
assert.equal(verifyCompositeSourceManifest(manifest).status, "ready");
assert.deepEqual(verifyCompositeSourceManifest({ ...manifest, components: [{ ...component, observedCurrentRevisionId: "rev-3" }] }), { status: "blocked", staleDisciplines: ["Mechanical"] });
assert.throws(() => verifyCompositeSourceManifest({ ...manifest, components: [component, { ...component, coordinationFileId: "file-2" }] }));
console.log("composite source control behavior: PASS");
