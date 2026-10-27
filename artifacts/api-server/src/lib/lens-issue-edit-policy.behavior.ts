import assert from "node:assert/strict";
import { assertCatalogLabel, assertLensIssueStatusTransition, normalizeGovernedLabel } from "./lens-issue-edit-policy";

assert.doesNotThrow(() => assertLensIssueStatusTransition("open", "follow_up"));
assert.doesNotThrow(() => assertLensIssueStatusTransition("resolved", "open"));
assert.throws(() => assertLensIssueStatusTransition("resolved", "approved"), /TRANSITION_INVALID/);
assert.equal(assertCatalogLabel("mainline pools", ["Mainline Pools"], "responsibleCompany"), "Mainline Pools");
assert.throws(() => assertCatalogLabel("Other", ["Mainline Pools"], "responsibleCompany"), /CATALOG_VALUE_FORBIDDEN/);
assert.equal(normalizeGovernedLabel("  Section   A ", "floor"), "Section A");
console.log("Lens Build 003 edit policy, transition matrix, and catalog enforcement: PASS");
