import assert from "node:assert/strict";
import fs from "node:fs";

const handoff = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build74-publication-handoff.json", "utf8"));
const claude = fs.readFileSync("living-brief/CLAUDE.md", "utf8");
const platform = fs.readFileSync("living-brief/PLATFORM.md", "utf8");

assert.equal(handoff.schemaVersion, "bimlog-ga-build74-publication-handoff-v1");
assert.equal(handoff.provider, "Replit");
assert.deepEqual(handoff.route, ["GitHub", "Replit Shell", "Replit Publish", "Authenticated Chrome"]);
assert.equal(handoff.sourcePolicy.exactPushedCommitRequired, true);
assert.equal(handoff.sourcePolicy.cleanReplitCheckoutRequired, true);
assert.equal(handoff.sourcePolicy.replitAgentAllowed, false);
assert.equal(handoff.sourcePolicy.forcePushAllowed, false);
assert.equal(handoff.databasePolicy.developmentDataCopy, "OFF_REQUIRED");
assert.ok(Object.values(handoff.identityPolicy).every(Boolean));
assert.equal(handoff.cadence.pushAfterBuild, 75);
assert.equal(handoff.cadence.publishAfterBuild, 80);
assert.ok(handoff.cadence.maximumUnpublishedBuilds <= 10);
assert.match(claude, /Replit Agents and prompt-based Replit\s+source changes are prohibited/i);
assert.match(platform, /Replit is the established BIMLog publication provider/i);
assert.equal(handoff.state, "READY_FOR_BLOCK75_SEAL_NOT_PUBLISHED");

console.log("BIMLog GA Build 74: PASS exact-provider publication handoff and ten-build cadence");
