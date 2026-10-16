import assert from "node:assert/strict";
import { governanceReviewerGuidance } from "./workflow-policy-error";

const english = governanceReviewerGuidance(["CEO", "OPERATIONS_DIRECTOR", "CEO"], false);
assert.match(english, /CEO, OPERATIONS_DIRECTOR/);
assert.match(english, /does not identify a person or grant access/);
assert.match(english, /another user/);

const spanish = governanceReviewerGuidance(["FINANCE_APPROVER"], true);
assert.match(spanish, /FINANCE_APPROVER/);
assert.match(spanish, /no identifica a una persona ni concede acceso/);
assert.match(spanish, /otro usuario/);

console.log("LORENA_B06_GOVERNANCE_GUIDANCE=PASS");
