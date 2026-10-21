import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const receipt = JSON.parse(readFileSync("evidence/full-ga-remediation-20261021/publication-boundary.json", "utf8"));
assert.equal(receipt.schemaVersion, "bimlog-full-ga-publication-boundary-v1");
assert.match(receipt.sourceCommit, /^[0-9a-f]{40}$/);
assert.equal(receipt.sourceCommit, "88592e903fb454081141c3a987277c867930ef39");
assert.equal(receipt.identityBound, true);
assert.equal(receipt.authenticatedDesktopRoute, "/projects/64/integrations");
assert.equal(receipt.authenticatedDesktopResult, "loaded");
assert.equal(receipt.productionMutation, false);
assert.ok(receipt.packageId.includes(receipt.sourceCommit.slice(0, 16)));

console.log("Full-GA Block 5 Build 21 exact publication identity and authenticated desktop boundary: PASS");
