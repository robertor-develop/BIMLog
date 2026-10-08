import assert from "node:assert/strict";
import { contractRegisterHref, parseContractDeepLink } from "./contract-deep-link";
import { readFileSync } from "node:fs";

const linked = parseContractDeepLink("contractId=contract-7&returnTo=" + encodeURIComponent("/projects/7/intake?stage=contract&item=ji-contract-2"), 7);
assert.equal(linked.contractId, "contract-7");
assert.equal(linked.intakeReturn?.href, "/projects/7/intake?stage=contract&item=ji-contract-2");
assert.equal(linked.invalid, false);
assert.equal(contractRegisterHref(7, linked.intakeReturn), "/projects/7/financial/contracts?returnTo=%2Fprojects%2F7%2Fintake%3Fstage%3Dcontract%26item%3Dji-contract-2");

for (const search of ["contractId=", "contractId=one&contractId=two", "contractId=../escape", "contractId=" + "x".repeat(129)]) {
  const result = parseContractDeepLink(search, 7);
  assert.equal(result.contractId, null);
  assert.equal(result.invalid, true);
}
assert.equal(parseContractDeepLink("contractId=contract-7&returnTo=" + encodeURIComponent("/projects/8/intake?stage=contract"), 7).invalid, true);
const workspace = readFileSync(new URL("../pages/FinancialContractWorkspace.tsx", import.meta.url), "utf8");
assert.match(workspace, /parseContractDeepLink\(routeSearch, projectId\)/);
assert.match(workspace, /No other contract was substituted/);
assert.match(workspace, /does not belong to this project/);
assert.match(workspace, /String\(contract\.id\) === requestedContract\) return true/);
assert.match(workspace, /remains visible even if register filters do not match it/);
console.log("Contract deep link: bounded identity and exact same-project Intake origin PASS");
