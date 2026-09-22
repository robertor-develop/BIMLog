import assert from "node:assert/strict";
import { BIMTECH_COORDINATION_STARTER_LIBRARY as seed } from "./bimtech-coordination-starter-library";

assert.equal(seed.rules.length, 8);
assert.equal(seed.resolutionMethods.length, 8);
assert.ok(seed.rules.every(rule => rule.conflictTypeCodes.length > 0));
assert.ok(seed.resolutionMethods.every(method => method.conflictTypeCodes.length > 0 && method.ruleCodes.length > 0));
assert.ok(seed.resolutionMethods.every(method => method.requiredApprovals.length > 0));
assert.ok(seed.resolutionMethods.every(method => method.rfiRequirement === "conditional" || method.rfiRequirement === "required"));

const allText = JSON.stringify(seed).toLocaleLowerCase("en-US");
assert.equal(allText.includes("preferred"), false, "unreviewed starter methods must not claim preferred status");
assert.equal(allText.includes("professionally approved"), false, "starter content must not claim professional approval");
assert.ok(allText.includes("does not issue engineering direction"));
assert.ok(allText.includes("responsible design authority"));

console.log("Build 268 starter Rules and Resolution Methods: PASS (draft candidates, explicit approvals)");
