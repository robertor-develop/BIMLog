import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dossier = JSON.parse(readFileSync("evidence/ga-closure-20261020/orion-ga-dossier.json", "utf8"));
const report = readFileSync("evidence/ga-closure-20261020/ORION_GA_DOSSIER.md", "utf8");

assert.equal(dossier.gaReady, false);
assert.equal(dossier.certificationAuthority, "independent_read_only_review");
assert.equal(dossier.dimensions.code.state, "pass");
assert.equal(dossier.dimensions.currentCandidate.state, "unpublished");
assert.equal(dossier.dimensions.deployed.state, "pass_previous_published_head");
assert.equal(dossier.dimensions.authenticatedLive.state, "pass_previous_published_head");
assert.equal(dossier.dimensions.procoreAccount.state, "partial_external_block");
assert.equal(dossier.dimensions.protectedFileRecovery.registeredFiles, 16);
assert.equal(dossier.dimensions.protectedFileRecovery.portableCustodyVerified, 0);
assert.equal(dossier.dimensions.temporaryProjectCleanup.deleteCount, 0);
assert.equal(dossier.dimensions.customerFieldAcceptance.state, "not_claimed");
assert.match(report, /GA_READY=false/);
assert.match(report, /no recovered-original claim/i);
assert.match(report, /zero deletions/i);

console.log("GA-CLOSURE-B015 PASS: dossier separates code, candidate, deployed, live, Procore, recovery, cleanup and customer acceptance without self-certifying GA");
