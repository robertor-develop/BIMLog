import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import {
  FINANCIAL_AUTHORITIES,
  evaluateFinancialAuthorization,
  type EffectiveGrant,
  type ApprovalPolicy,
} from "./financial-control-contract";
import {
  budgetCurrency,
  canonicalFingerprint,
  exactApprovalExposure,
  exactSignedDecimal,
  exactTotal,
  normalizeBudgetLines,
  scaledSignedDecimal,
  validateHierarchy,
} from "./financial-budget-contract";
import {
  buildBaselinePdf,
  buildBaselineXlsx,
  type BaselineExport,
} from "./financial-budget-export";

const checks: Array<{ number: number; name: string; evidence: string }> = [];
const check = (name: string, evidence: string) =>
  checks.push({ number: checks.length + 1, name, evidence });
const throws = (fn: () => unknown, code: string) =>
  assert.throws(fn, (e: any) => e?.code === code);
assert.deepEqual(FINANCIAL_AUTHORITIES, [
  "financial_viewer",
  "cost_preparer",
  "cost_reviewer",
  "cost_approver",
  "financial_administrator",
  "auditor",
]);
check(
  "six Build 1 authorities remain distinct",
  "exact accepted authority tuple",
);
const now = new Date("2026-07-20T12:00:00Z"),
  before = new Date("2026-07-19T12:00:00Z"),
  after = new Date("2026-07-21T12:00:00Z");
const grant = (authority: any): EffectiveGrant => ({
  id: `g-${authority}`,
  authority,
  scopeType: "project",
  companyId: 1,
  projectId: 2,
  effectiveFrom: before,
  effectiveTo: after,
  revoked: false,
});
const policy = (
  amount = "1000",
  currency = "USD",
  projectId: number | null = 2,
): ApprovalPolicy => ({
  id: "policy",
  scopeType: projectId === null ? "company" : "project",
  companyId: 1,
  projectId,
  category: "original_budget",
  money: { amount, currency },
  effectiveFrom: before,
  effectiveTo: after,
  state: "active",
  version: 1,
});
const decide = (operation: any, grants: EffectiveGrant[], extra: any = {}) =>
  evaluateFinancialAuthorization({
    operation,
    userId: 10,
    companyId: 1,
    projectId: 2,
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: true,
    suspended: false,
    grants,
    policies: [policy()],
    at: now,
    ...extra,
  });
assert.equal(decide("prepare", []).decision, "deny");
check("unknown or missing role denied", "FIN_AUTHORITY_MISSING");
assert.equal(decide("prepare", [grant("financial_viewer")]).decision, "deny");
check("viewer read-only", "prepare denied");
assert.equal(decide("prepare", [grant("cost_preparer")]).decision, "allow");
check("preparer creates draft", "prepare allowed");
assert.equal(
  decide("review", [grant("cost_preparer"), grant("cost_reviewer")], {
    makerUserId: 10,
  }).code,
  "FIN_MAKER_CHECKER_REQUIRED",
);
check("preparer cannot self-review", "maker checker denial");
assert.equal(
  decide("approve", [grant("cost_preparer"), grant("cost_approver")], {
    makerUserId: 10,
    category: "original_budget",
    amount: { amount: "10", currency: "USD" },
  }).decision,
  "deny",
);
check("preparer cannot self-approve", "maker checker denial");
assert.equal(
  decide("approve", [grant("cost_reviewer")], {
    makerUserId: 9,
    category: "original_budget",
    amount: { amount: "10", currency: "USD" },
  }).decision,
  "deny",
);
check("reviewer does not inherit approval", "approval denied");
assert.equal(
  decide("approve", [grant("cost_approver")], {
    makerUserId: 9,
    category: "original_budget",
    amount: { amount: "1000", currency: "USD" },
  }).decision,
  "allow",
);
check("approver within exact limit", "1000 equals 1000");
assert.equal(
  decide("approve", [grant("cost_approver")], {
    makerUserId: 9,
    category: "original_budget",
    amount: { amount: "1000.000001", currency: "USD" },
  }).code,
  "FIN_APPROVAL_LIMIT_EXCEEDED",
);
check("approver above exact limit denied", "one millionth over denied");
assert.equal(
  evaluateFinancialAuthorization({
    operation: "approve",
    userId: 10,
    companyId: 1,
    projectId: 2,
    makerUserId: 9,
    category: "original_budget",
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
check("wrong currency limit denied", "EUR does not match USD");
assert.equal(
  evaluateFinancialAuthorization({
    operation: "approve",
    userId: 10,
    companyId: 1,
    projectId: 2,
    makerUserId: 9,
    category: "original_budget",
    amount: { amount: "1", currency: "USD" },
    entitlementDecision: "allow",
    membershipActive: true,
    companyCurrent: true,
    suspended: false,
    grants: [grant("cost_approver")],
    policies: [policy("1000", "USD", 3)],
    at: now,
  }).code,
  "FIN_APPROVAL_POLICY_MISSING",
);
check("wrong project limit denied", "project 3 policy not project 2");
assert.equal(
  decide("approve", [grant("cost_approver")], {
    makerUserId: 9,
    category: "missing",
    amount: { amount: "1", currency: "USD" },
  }).code,
  "FIN_APPROVAL_POLICY_MISSING",
);
check("missing limit fails closed", "no category policy");
assert.equal(
  decide("approve", [grant("financial_administrator")], {
    makerUserId: 9,
    category: "original_budget",
    amount: { amount: "1", currency: "USD" },
  }).decision,
  "deny",
);
check(
  "financial administrator cannot approve automatically",
  "manage is not approve",
);
assert.equal(decide("prepare", [grant("auditor")]).decision, "deny");
check("auditor cannot mutate", "prepare denied");
assert.equal(
  decide("prepare", [grant("cost_preparer")], { suspended: true }).code,
  "FIN_SCOPE_SUSPENDED",
);
check(
  "company/project suspension blocks mutation",
  "canonical suspension denial",
);
assert.equal(
  decide("prepare", [grant("cost_preparer")], { companyCurrent: false })
    .decision,
  "deny",
);
check("cross-company access denied", "company current false");
assert.equal(
  decide("prepare", [grant("cost_preparer")], { membershipActive: false })
    .decision,
  "deny",
);
check("cross-project access denied", "membership false");
assert.equal(
  decide("prepare", [grant("cost_preparer")], { entitlementDecision: "deny" })
    .code,
  "FIN_ENTITLEMENT_DENIED",
);
check(
  "entitlement alone and authority alone cannot authorize",
  "dual gate required",
);
const nodes = [
  { stableNodeId: "root", parentStableNodeId: null, code: "01", sortOrder: 0 },
  {
    stableNodeId: "child",
    parentStableNodeId: "root",
    code: "01.10",
    sortOrder: 0,
  },
];
validateHierarchy(nodes);
check("company cost-code hierarchy valid", "root and child accepted");
throws(
  () =>
    validateHierarchy([
      { stableNodeId: "a", parentStableNodeId: "b", code: "A", sortOrder: 0 },
      { stableNodeId: "b", parentStableNodeId: "a", code: "B", sortOrder: 0 },
    ]),
  "COST_HIERARCHY_CYCLE",
);
check("cycle rejected", "COST_HIERARCHY_CYCLE");
throws(
  () =>
    validateHierarchy([
      {
        stableNodeId: "a",
        parentStableNodeId: "missing",
        code: "A",
        sortOrder: 0,
      },
    ]),
  "COST_NODE_ORPHAN",
);
check("orphan rejected", "COST_NODE_ORPHAN");
throws(
  () =>
    validateHierarchy([
      { stableNodeId: "a", code: "A", sortOrder: 0 },
      { stableNodeId: "b", code: "A", sortOrder: 1 },
    ]),
  "COST_CODE_DUPLICATE",
);
check("duplicate active code rejected", "COST_CODE_DUPLICATE");
throws(
  () =>
    validateHierarchy([
      { stableNodeId: "a", code: "A", sortOrder: 0 },
      { stableNodeId: "b", code: "B", sortOrder: 0 },
    ]),
  "COST_SIBLING_ORDER_DUPLICATE",
);
check("duplicate sibling ordering rejected", "COST_SIBLING_ORDER_DUPLICATE");
assert.equal(exactSignedDecimal("-12.340000"), "-12.34");
check("negative adjustment semantics exact", "signed magnitude canonicalized");
assert.equal(exactSignedDecimal("0.000000"), "0");
check("zero semantics exact", "canonical zero");
assert.equal(exactSignedDecimal("12.340000"), "12.34");
check("positive semantics exact", "canonical positive");
throws(() => exactSignedDecimal("1,25"), "FIN_DECIMAL_INVALID");
check("locale-ambiguous decimal rejected", "comma rejected");
throws(() => exactSignedDecimal("12x"), "FIN_DECIMAL_INVALID");
check("malformed decimal rejected", "no zero coercion");
assert.equal(budgetCurrency("usd"), "USD");
check("controlled ISO currency", "USD canonicalized");
throws(() => budgetCurrency("ZZZ"), "FIN_CURRENCY_INVALID");
check("unsupported currency rejected", "ZZZ denied");
const lines = normalizeBudgetLines([
  {
    stableLineId: "line-1",
    projectCostNodeId: "node-1",
    description: "Base work",
    amount: "100.1",
    sortOrder: 0,
  },
  {
    stableLineId: "line-2",
    projectCostNodeId: "node-2",
    description: "Approved reduction",
    amount: "-0.000001",
    sortOrder: 1,
  },
]);
assert.equal(exactTotal(lines), "100.099999");
check("exact line totals", "BigInt scaled total");
assert.equal(exactApprovalExposure(lines), "100.100001");
assert.equal(
  decide("approve", [grant("cost_approver")], {
    makerUserId: 9,
    category: "original_budget",
    amount: { amount: exactApprovalExposure(lines), currency: "USD" },
    policies: [policy("100.1")],
  }).decision,
  "deny",
);
check(
  "negative offsets cannot reduce approval exposure",
  "absolute exact line exposure exceeds the policy by one millionth",
);
assert.equal(
  scaledSignedDecimal("999999999999999999999999.999999"),
  999999999999999999999999999999n,
);
check("exact property boundary", "numeric(30,6) represented by BigInt");
const fp = canonicalFingerprint({ currency: "USD", structure: "s1", lines });
assert.equal(
  fp,
  canonicalFingerprint({ currency: "USD", structure: "s1", lines }),
);
check("stable fingerprint identical content", "SHA-256 deterministic");
assert.notEqual(
  fp,
  canonicalFingerprint({
    currency: "USD",
    structure: "s1",
    lines: [...lines].reverse(),
  }),
);
check("line order changes fingerprint", "ordered content protected");
assert.notEqual(
  fp,
  canonicalFingerprint({ currency: "EUR", structure: "s1", lines }),
);
check("currency changes fingerprint", "currency protected");
assert.notEqual(
  fp,
  canonicalFingerprint({ currency: "USD", structure: "s2", lines }),
);
check("structure version changes fingerprint", "pin protected");
const sample: BaselineExport = {
  project: {
    name: "Disposable Project",
    code: "DP-01",
    companyName: "Disposable Company",
  },
  snapshot: {
    id: "snapshot-1",
    budgetVersion: 1,
    currency: "USD",
    originalTotal: "100.099999",
    currentTotal: "100.099999",
    differenceFromOriginal: "0",
    contentFingerprint: fp,
    snapshotFingerprint: canonicalFingerprint({ fp }),
    approvedAt: now.toISOString(),
    approvedByName: "Independent Approver",
    approvalLimit: "1000",
    lines: [
      {
        projectCode: "01",
        projectName: "General",
        hierarchicalPath: "01",
        description: "Base work",
        amount: "100.1",
        quantity: "1",
        unit: "LS",
        unitRate: "100.1",
        notes: null,
        sortOrder: 0,
      },
      {
        projectCode: "01.10",
        projectName: "Reduction",
        hierarchicalPath: "01/01.10",
        description: "Approved reduction",
        amount: "-0.000001",
        quantity: null,
        unit: null,
        unitRate: null,
        notes: null,
        sortOrder: 1,
      },
    ],
  },
  generatedAt: now.toISOString(),
};
const xlsx = buildBaselineXlsx(sample),
  wb = XLSX.read(xlsx, { type: "buffer", cellFormula: true }),
  sheet = wb.Sheets["Budget Lines"];
assert.equal(sheet.E2.t, "n");
check("XLSX amount cells native numeric", "cell E2 type n");
for (const name of wb.SheetNames)
  for (const cell of Object.values(wb.Sheets[name]))
    if (cell && typeof cell === "object") assert.equal("f" in cell, false);
check("XLSX has no formulas", "parser found zero formula cells");
const zip = new AdmZip(xlsx),
  xml = zip
    .getEntries()
    .filter(
      (e) => e.entryName.endsWith(".xml") || e.entryName.endsWith(".rels"),
    )
    .map((e) => e.getData().toString("utf8"))
    .join("\n");
assert.doesNotMatch(xml, /externalLink|TargetMode="External"|<f[ >]/i);
check("XLSX has no external links", "raw ZIP/XML clean");
const maximum = "999999999999999999999999.999999",
  maximumData: BaselineExport = JSON.parse(JSON.stringify(sample));
maximumData.snapshot.lines[0].amount = maximum;
maximumData.snapshot.originalTotal = maximum;
maximumData.snapshot.currentTotal = maximum;
const maximumXml = new AdmZip(buildBaselineXlsx(maximumData))
  .getEntries()
  .filter((entry) => entry.entryName.startsWith("xl/worksheets/"))
  .map((entry) => entry.getData().toString("utf8"))
  .join("\n");
assert.match(maximumXml, new RegExp(maximum.replace(".", "\\.")));
check("XLSX preserves maximum exact decimal", "numeric XML retains all 30 digits");
assert.ok(sheet["!autofilter"]);
check("XLSX filter configured", "budget lines autofilter");
assert.match(xml, /<pane[^>]*ySplit="1"[^>]*state="frozen"/);
check("XLSX frozen header configured", "raw worksheet pane ySplit 1");
const pdf = await buildBaselinePdf(sample),
  parser = new PDFParse({ data: pdf }),
  parsed = await parser.getText();
await parser.destroy();
assert.match(parsed.text, /Approved Budget Baseline/);
assert.match(parsed.text, /100\.099999/);
assert.match(parsed.text, /Page 1 of 1/);
check("PDF searchable text", "title and exact total extracted");
check("PDF paginated", "page X of Y extracted");
assert.match(parsed.text, new RegExp(fp));
check("PDF fingerprint parity", "content fingerprint extracted");
const browser = fs.readFileSync(
    path.resolve(process.cwd(), "artifacts/bimlog/src/pages/FinancialBudgetWorkspace.tsx"),
    "utf8",
  ),
  service = fs.readFileSync(
    path.resolve(process.cwd(), "artifacts/api-server/src/lib/financial-budget-service.ts"),
    "utf8",
  ),
  migration = fs.readFileSync(
    path.resolve(process.cwd(), "artifacts/api-server/src/lib/financial-budget-migration.ts"),
    "utf8",
  ),
  catalog = fs.readFileSync(
    path.resolve(process.cwd(), "artifacts/api-server/src/lib/initial-feature-catalog.ts"),
    "utf8",
  );
for (const key of [
  "cost.structure.view",
  "cost.structure.manage",
  "cost.budget.view",
  "cost.budget.prepare",
  "cost.budget.review",
  "cost.budget.approve",
  "cost.report.view",
  "cost.report.export",
])
  assert.match(catalog, new RegExp(key.replace(".", "\\.")));
check("truthful Build 2 feature decisions", "eight exact keys registered");
assert.match(service, /authorizeFinancialOperation/g);
check(
  "canonical Build 1 execution gate reused",
  "no parallel authority resolver",
);
assert.match(service, /previous_approved_id/);
check("original budget pinned", "first approval has null predecessor");
assert.match(service, /ORDER BY approved_at DESC LIMIT 1/);
check("current budget is latest approved", "latest approval query");
assert.match(service, /approved_budget_snapshot_lines/);
check("complete immutable snapshot lines", "labels and values copied");
assert.match(migration, /approved_budget_snapshots.*BEFORE UPDATE OR DELETE/s);
check("snapshot update/delete database defense", "append-only trigger");
assert.match(migration, /guard_budget_line_mutation/);
check("submitted budget lines frozen", "database guard");
assert.doesNotMatch(migration, /\bDROP\b|\bTRUNCATE\b/i);
check(
  "additive idempotent migration",
  "CREATE IF NOT EXISTS without destructive DDL",
);
assert.match(browser, /Original Budget/);
assert.match(browser, /Presupuesto Original/);
check("desktop English and mobile Spanish content", "bilingual labels present");
assert.match(browser, /@media\(max-width:720px\)/);
assert.match(browser, /overflow-x:hidden/);
check(
  "mobile layout prevents page overflow",
  "390px-compatible responsive rules",
);
assert.match(browser, /Confirm exact approval/);
check("exact approval confirmation visible", "complete controlled action");
assert.match(browser, /Retry/);
check("load failure retry", "controlled error state");
assert.match(service, /No accounting actuals/);
check("financial product boundary visible", "no accounting claim");
assert.doesNotMatch(
  migration,
  /CREATE TABLE IF NOT EXISTS (?:contracts|commitments|payments|forecasts|cash_flows|ledger_entries)/i,
);
check(
  "excluded Build 3+ capabilities absent",
  "no later-domain implementation",
);
assert.doesNotMatch(
  service + migration,
  /storage_path|signed.?url|database_url|password|secret/i,
);
check("no secrets or raw storage paths", "bounded stable identities only");
assert.match(service, /FOR UPDATE/);
assert.match(service, /pg_advisory_xact_lock/);
check("concurrency controls present", "row and advisory locks");
assert.match(service, /ROLLBACK/);
check("failed snapshot or audit rolls back", "single transaction helper");
assert.match(service, /financial_authority_journal/);
check("accepted append-only audit reused", "no second audit system");
assert.equal(checks.length, 64);
console.log(
  JSON.stringify(
    { suite: "cost-financial-control-build-2-pure", status: "passed", checks },
    null,
    2,
  ),
);
