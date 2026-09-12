import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = JSON.parse(
  fs.readFileSync(
    new URL("../../../../evidence/post-p18-build74-project-directory-live-readonly.json", import.meta.url),
    "utf8",
  ),
);

assert.equal(evidence.result, "PASS");
assert.equal(evidence.browser, "Chrome");
assert.equal(evidence.url, "https://bimlog.app/projects/27/directory");
assert.equal(evidence.projectId, 27);
assert.equal(evidence.projectCode, "ROB-T1");
assert.equal(evidence.authenticatedRole, "project_admin");
assert.equal(evidence.liveVersion, "v1.05.N17-P17");
assert.equal(evidence.candidateVersion, "v1.05.N17-P18");
assert.equal(evidence.candidatePublished, false);
assert.equal(evidence.visibleProof.heading, "Directorio del Proyecto");
assert.equal(evidence.visibleProof.memberCount, 1);
assert.equal(evidence.visibleProof.additionalContactCount, 1);
assert.deepEqual(evidence.visibleProof.filters, ["search", "scope", "role", "status", "sort"]);
assert.equal(evidence.visibleProof.controls.length, 5);
assert.match(evidence.visibleProof.contextualHelp, /context=directory/);
assert.equal(evidence.visibleProof.browserWarningErrorCount, 0);
assert.deepEqual(evidence.mutationsPerformed, []);
assert.equal(
  Object.values(evidence.boundaries).every((value) => value === false),
  true,
);

console.log("POST-P18 Build 74 Project Directory live read-only: PASS");
