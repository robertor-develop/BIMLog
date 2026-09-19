import assert from "node:assert/strict";
import { evaluateCommercialPrice } from "./financial-correctness-contract";
import { approveFinancialRevision, createFinancialRevision } from "./financial-revision-ledger";

const firstPrice = evaluateCommercialPrice({ quantity: "10", unitPrice: "100", currency: "USD" });
let history = createFinancialRevision([], 11, firstPrice, "Initial approved commercial baseline");
assert.throws(() => approveFinancialRevision(history, 11, history[0].fingerprint, "Self approval must be denied"), (error: any) => error.code === "FIN_MAKER_CHECKER_REQUIRED");
history = approveFinancialRevision(history, 22, history[0].fingerprint, "Independent finance approval recorded");
const approved = history[0];
history = createFinancialRevision(history, 11, evaluateCommercialPrice({ quantity: "10", unitPrice: "105", currency: "USD" }), "Supplier pricing revision received");
assert.equal(history[0].status, "superseded");
assert.equal(history[0].price.total, approved.price.total);
assert.equal(history[1].supersedesFingerprint, approved.fingerprint);
assert.throws(() => approveFinancialRevision(history, 22, approved.fingerprint, "Attempt approval with stale confirmation"), (error: any) => error.code === "FINANCIAL_REVISION_STALE");
history = approveFinancialRevision(history, 22, history[1].fingerprint, "Independent revised price approval");
assert.deepEqual(history.map(item => [item.version, item.status, item.preparedBy, item.approvedBy]), [[1,"superseded",11,22],[2,"approved",11,22]]);
console.log("Build 054 immutable financial revision history: PASS");
