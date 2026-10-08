import assert from "node:assert/strict";
import { contractRegisterHref, parseContractDeepLink } from "./contract-deep-link";

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
console.log("Contract deep link: bounded identity and exact same-project Intake origin PASS");
