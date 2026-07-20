import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  compareMoney,
  evaluateFinancialAuthorization,
  isFinancialScopeSuspended,
  parseCurrency,
  parseDecimal,
  parseMoney,
  type ApprovalPolicy,
  type EffectiveGrant,
  type FinancialOperation,
} from "./financial-control-contract";

const checks: Array<{ number: number; name: string; evidence: string }> = [];
const check = (name: string, evidence: string) =>
  checks.push({ number: checks.length + 1, name, evidence });
const now = new Date("2026-07-20T12:00:00.000Z"),
  later = new Date("2026-07-21T12:00:00.000Z"),
  before = new Date("2026-07-19T12:00:00.000Z");
const grant = (
  authority: EffectiveGrant["authority"],
  overrides: Partial<EffectiveGrant> = {},
): EffectiveGrant => ({
  id: `grant-${authority}`,
  authority,
  scopeType: "company",
  companyId: 1,
  projectId: null,
  effectiveFrom: before,
  effectiveTo: later,
  revoked: false,
  ...overrides,
});
const policy = (overrides: Partial<ApprovalPolicy> = {}): ApprovalPolicy => ({
  id: "policy-1",
  scopeType: "company",
  companyId: 1,
  projectId: null,
  category: "change_order",
  money: { amount: "1000", currency: "USD" },
  effectiveFrom: before,
  effectiveTo: later,
  state: "active",
  version: 1,
  ...overrides,
});
const evaluate = (
  operation: FinancialOperation,
  grants: EffectiveGrant[],
  extra: Record<string, unknown> = {},
) =>
  evaluateFinancialAuthorization({
    operation,
    userId: 10,
    companyId: 1,
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: true,
    suspended: false,
    grants,
    policies: [policy()],
    at: now,
    ...extra,
  });

assert.equal(parseDecimal("0.000001"), "0.000001");
check("minimum supported exact precision", "0.000001 retained");
assert.equal(
  parseDecimal("999999999999999999999999.999999"),
  "999999999999999999999999.999999",
);
check("maximum exact range", "numeric(30,6) boundary retained");
assert.equal(parseDecimal("12.340000"), "12.34");
check(
  "canonical decimal representation",
  "trailing zeros removed without floating point",
);
for (const value of [
  12.5,
  "1e3",
  "NaN",
  "Infinity",
  "01.00",
  "-1",
  "1.1234567",
]) {
  assert.throws(() => parseDecimal(value));
}
check(
  "malformed and non-finite amounts",
  "numbers, exponent, nonfinite, leading zero, negative and overprecision rejected",
);
assert.deepEqual(parseMoney({ amount: "42.01", currency: "usd" }), {
  amount: "42.01",
  currency: "USD",
});
check("ISO currency normalization", "USD validated and normalized");
assert.throws(() => parseCurrency("ZZZ"));
check("unknown currency", "unknown ISO code rejected");
assert.equal(
  compareMoney(
    { amount: "10.000001", currency: "USD" },
    { amount: "10", currency: "USD" },
  ),
  1,
);
check("exact comparison", "BigInt scaled comparison preserves sixth decimal");
assert.throws(() =>
  compareMoney(
    { amount: "10", currency: "USD" },
    { amount: "10", currency: "EUR" },
  ),
);
check("mixed-currency comparison", "conversion and aggregation rejected");

const matrix: Array<[FinancialOperation, EffectiveGrant["authority"]]> = [
  ["read", "financial_viewer"],
  ["prepare", "cost_preparer"],
  ["review", "cost_reviewer"],
  ["approve", "cost_approver"],
  ["manage", "financial_administrator"],
  ["audit_read", "auditor"],
];
for (const [operation, authority] of matrix) {
  const extra =
    operation === "approve"
      ? {
          makerUserId: 20,
          category: "change_order",
          amount: { amount: "10", currency: "USD" },
        }
      : operation === "review"
        ? { makerUserId: 20 }
        : {};
  assert.equal(
    evaluate(operation, [grant(authority)], extra).decision,
    "allow",
  );
  check(
    `${authority} authority`,
    `${operation} allowed only by explicit grant`,
  );
}
assert.equal(
  evaluate("approve", [grant("cost_reviewer")], {
    makerUserId: 20,
    category: "change_order",
    amount: { amount: "10", currency: "USD" },
  }).code,
  "FIN_AUTHORITY_MISSING",
);
check("reviewer is not approver", "review grant denied final approval");
assert.equal(
  evaluate("approve", [grant("financial_administrator")], {
    makerUserId: 20,
    category: "change_order",
    amount: { amount: "10", currency: "USD" },
  }).code,
  "FIN_AUTHORITY_MISSING",
);
check(
  "administrator is not approver",
  "administrator grant denied final approval",
);
assert.equal(
  evaluate("review", [grant("cost_reviewer")], { makerUserId: 10 }).code,
  "FIN_MAKER_CHECKER_REQUIRED",
);
check("review maker/checker", "maker denied own review");
assert.equal(
  evaluate("approve", [grant("cost_approver")], {
    makerUserId: 10,
    category: "change_order",
    amount: { amount: "10", currency: "USD" },
  }).code,
  "FIN_MAKER_CHECKER_REQUIRED",
);
check("approval maker/checker", "maker denied own approval");
assert.equal(
  evaluate("approve", [grant("cost_approver")], {
    makerUserId: 20,
    category: "change_order",
    amount: { amount: "1000.000001", currency: "USD" },
  }).code,
  "FIN_APPROVAL_LIMIT_EXCEEDED",
);
check("approval exact limit", "one millionth over limit denied");
assert.equal(
  evaluateFinancialAuthorization({
    operation: "approve",
    userId: 10,
    companyId: 1,
    makerUserId: 20,
    category: "change_order",
    amount: { amount: "1", currency: "USD" },
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: true,
    suspended: false,
    grants: [grant("cost_approver")],
    policies: [],
    at: now,
  }).code,
  "FIN_APPROVAL_POLICY_MISSING",
);
check("missing approval policy", "fail closed");
assert.equal(
  evaluateFinancialAuthorization({
    operation: "approve",
    userId: 10,
    companyId: 1,
    makerUserId: 20,
    category: "change_order",
    amount: { amount: "1", currency: "EUR" },
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: true,
    suspended: false,
    grants: [grant("cost_approver")],
    policies: [policy()],
    at: now,
  }).code,
  "FIN_APPROVAL_POLICY_MISSING",
);
check("approval currency mismatch", "fail closed without conversion");
assert.equal(
  evaluateFinancialAuthorization({
    operation: "approve",
    userId: 10,
    companyId: 1,
    makerUserId: 20,
    category: "change_order",
    amount: { amount: "1", currency: "USD" },
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: true,
    suspended: false,
    grants: [grant("cost_approver")],
    policies: [
      policy(),
      policy({ id: "policy-2", version: 2, state: "revoked" }),
    ],
    at: now,
  }).code,
  "FIN_APPROVAL_POLICY_MISSING",
);
check("revoked latest approval policy", "older active limit does not reappear");
assert.equal(evaluate("read", []).code, "FIN_AUTHORITY_MISSING");
check("ordinary application role", "no implicit financial authority");
assert.equal(
  evaluateFinancialAuthorization({
    operation: "read",
    userId: 10,
    companyId: 1,
    entitlementDecision: "deny",
    membershipActive: true,
    companyCurrent: true,
    suspended: false,
    grants: [grant("financial_viewer")],
    policies: [],
    at: now,
  }).code,
  "FIN_ENTITLEMENT_DENIED",
);
check(
  "entitlement composition",
  "financial grant cannot override catalog denial",
);
assert.equal(
  evaluateFinancialAuthorization({
    operation: "read",
    userId: 10,
    companyId: 1,
    entitlementDecision: "allow",
    membershipActive: false,
    companyCurrent: true,
    suspended: false,
    grants: [grant("financial_viewer")],
    policies: [],
    at: now,
  }).code,
  "FIN_SCOPE_MEMBERSHIP_DENIED",
);
check("inactive membership", "fail closed");
assert.equal(
  evaluateFinancialAuthorization({
    operation: "read",
    userId: 10,
    companyId: 1,
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: false,
    suspended: false,
    grants: [grant("financial_viewer")],
    policies: [],
    at: now,
  }).code,
  "FIN_SCOPE_MEMBERSHIP_DENIED",
);
check("changed company", "fail closed");
assert.equal(
  evaluate("read", [grant("financial_viewer", { revoked: true })]).code,
  "FIN_AUTHORITY_MISSING",
);
check("revoked grant", "immediate deny");
assert.equal(
  evaluate("read", [grant("financial_viewer", { effectiveFrom: later })]).code,
  "FIN_AUTHORITY_MISSING",
);
check("future grant", "not yet effective");
assert.equal(
  evaluate("read", [grant("financial_viewer", { effectiveTo: before })]).code,
  "FIN_AUTHORITY_MISSING",
);
check("expired grant", "deny");
for (const operation of [
  "prepare",
  "review",
  "approve",
  "manage",
  "export",
  "integrate",
  "ai",
] as FinancialOperation[]) {
  const extra =
    operation === "approve"
      ? {
          makerUserId: 20,
          category: "change_order",
          amount: { amount: "1", currency: "USD" },
        }
      : operation === "review"
        ? { makerUserId: 20 }
        : {};
  assert.equal(
    evaluateFinancialAuthorization({
      operation,
      userId: 10,
      companyId: 1,
      entitlementDecision: "allow",
      membershipActive: true,
      companyCurrent: true,
      suspended: true,
      grants: [
        grant("cost_preparer"),
        grant("cost_reviewer"),
        grant("cost_approver"),
        grant("financial_administrator"),
      ],
      policies: [policy()],
      at: now,
      ...extra,
    }).code,
    "FIN_SCOPE_SUSPENDED",
  );
}
check(
  "suspension precedence",
  "mutations, review, approval, management, export, integrations and AI denied",
);
assert.equal(
  isFinancialScopeSuspended(
    [
      { projectId: null, action: "activate", occurredAt: before },
      { projectId: 91, action: "release", occurredAt: now },
    ],
    91,
  ),
  true,
);
assert.equal(
  isFinancialScopeSuspended(
    [
      { projectId: null, action: "release", occurredAt: now },
      { projectId: 91, action: "activate", occurredAt: before },
    ],
    91,
  ),
  true,
);
check(
  "company and project suspension composition",
  "a release at one scope never clears an active suspension at the other scope",
);
assert.equal(
  evaluateFinancialAuthorization({
    operation: "audit_read",
    userId: 10,
    companyId: 1,
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: true,
    suspended: true,
    grants: [grant("auditor")],
    policies: [],
    at: now,
  }).decision,
  "allow",
);
check("suspension audit preservation", "authorized audit read allowed");
const split = evaluate("approve", [grant("cost_approver")], {
  makerUserId: 20,
  category: "change_order",
  amount: { amount: "600", currency: "USD" },
  relatedRequests: [
    {
      makerUserId: 20,
      category: "change_order",
      amount: { amount: "500", currency: "USD" },
      createdAt: now,
    },
  ],
});
assert.equal(split.decision, "allow");
assert.equal(split.requiresHigherReview, true);
check(
  "related-request signal",
  "manual higher review signal without fraud claim",
);

const root = path.resolve(process.cwd(), "../..");
const ui = fs.readFileSync(
    path.join(root, "artifacts/bimlog/src/pages/FinancialControlsSettings.tsx"),
    "utf8",
  ),
  migration = fs.readFileSync(
    path.join(
      root,
      "artifacts/api-server/src/lib/financial-control-migration.ts",
    ),
    "utf8",
  ),
  service = fs.readFileSync(
    path.join(
      root,
      "artifacts/api-server/src/lib/financial-control-service.ts",
    ),
    "utf8",
  );
assert.match(ui, /Controles Financieros/);
assert.match(ui, /@media\(max-width:720px\)/);
check(
  "desktop/mobile bilingual settings",
  "responsive English/Spanish production component present",
);
assert.match(
  migration,
  /BEFORE UPDATE OR DELETE ON financial_authority_journal/,
);
check("journal database defense", "UPDATE and DELETE trigger installed");
assert.doesNotMatch(migration, /\bDROP\b/i);
check("additive migration", "no destructive schema operation");
assert.doesNotMatch(
  service + ui,
  /payment application|cash.?flow forecast|commitment ledger|contract ledger|cost event table/i,
);
check("Build 1 product boundary", "no later financial domain implemented");
assert.doesNotMatch(
  service,
  /stripe|wire transfer|ach|payment_intent|general ledger|journal entry/i,
);
check("no money movement or accounting", "authority control only");
assert.match(service, /resolveEffectiveEntitlement/);
check("canonical resolver integration", "accepted resolver composed directly");
assert.match(service, /synthetic:\s*true/);
check(
  "synthetic proof boundary",
  "authorization evidence creates no financial record",
);
console.log(
  JSON.stringify(
    { suite: "cost-financial-control-build-1", status: "passed", checks },
    null,
    2,
  ),
);
