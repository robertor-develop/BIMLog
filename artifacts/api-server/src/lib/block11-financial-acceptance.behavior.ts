import assert from "node:assert/strict";
import { evaluateFinancialAuthorization, type FinancialEvaluation } from "./financial-control-contract";
import { evaluateCommercialPrice } from "./financial-correctness-contract";
import { approveFinancialRevision, createFinancialRevision, exportFinancialRevisionCsv } from "./financial-revision-ledger";

const now = new Date("2026-09-19T12:00:00Z");
const base: FinancialEvaluation = { operation: "read", userId: 10, companyId: 7, projectId: 9, entitlementDecision: "allow", membershipActive: true, companyCurrent: true, suspended: false, grants: [], policies: [], at: now };
const grant = (id: string, authority: any, userProject: number | null = 9) => ({ id, authority, scopeType: userProject === null ? "company" as const : "project" as const, companyId: 7, projectId: userProject, effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null, revoked: false });
assert.equal(evaluateFinancialAuthorization({ ...base, grants: [grant("viewer", "financial_viewer")] }).decision, "allow");
assert.equal(evaluateFinancialAuthorization(base).code, "FIN_AUTHORITY_MISSING");
const approval = evaluateFinancialAuthorization({ ...base, operation: "approve", userId: 22, makerUserId: 11, grants: [grant("approver", "cost_approver")], category: "pricing_template", amount: { amount: "480000", currency: "USD" }, policies: [{ id: "policy", scopeType: "project", companyId: 7, projectId: 9, category: "pricing_template", money: { amount: "500000", currency: "USD" }, effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null, state: "active", version: 1 }] });
assert.equal(approval.decision, "allow");
assert.equal(evaluateFinancialAuthorization({ ...base, operation: "approve", userId: 11, makerUserId: 11, grants: [grant("approver", "cost_approver")], category: "pricing_template", amount: { amount: "480000", currency: "USD" } }).code, "FIN_MAKER_CHECKER_REQUIRED");

let history = createFinancialRevision([], 11, evaluateCommercialPrice({ quantity: "12", unitPrice: "40000", currency: "USD" }), "Controlled finance acceptance baseline");
history = approveFinancialRevision(history, 22, history[0].fingerprint, "Independent finance acceptance approval");
const csv = exportFinancialRevisionCsv(history);
assert.match(csv, /^"Version","Status","Prepared By","Approved By","Currency","Quantity","Unit Price","Total","Fingerprint"\r\n/);
assert.match(csv, /"1","approved","11","22","USD","12","40000","480000\.00","[a-f0-9]{64}"/);
assert.equal(csv.split("\r\n").filter(Boolean).length, 2);
console.log("Build 055 controlled finance role and export acceptance: PASS");
