import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { canonicalInternalCostRate, canonicalInternalCostRole } from "./internal-cost-contract";

assert.equal(canonicalInternalCostRate("5.10"), "5.1");
assert.equal(canonicalInternalCostRate("6.50"), "6.5");
assert.equal(canonicalInternalCostRole("DRAFTER"), "drafter");
assert.throws(() => canonicalInternalCostRate("-1"), /nonnegative decimal/);
const source = fs.readFileSync(path.join(import.meta.dirname, "internal-cost-governance.ts"), "utf8");
for (const token of ["company_internal_cost_policy_versions", "member_internal_cost_profile_versions", "effective_from", "proposed_by_id", "approved_by_id", "content_fingerprint"]) assert.match(source, new RegExp(token));
assert.doesNotMatch(source, /DEFAULT\s+5\.1|DEFAULT\s+6\.5/);
console.log("UX126 internal-cost policy versions and effective dates: PASS");
