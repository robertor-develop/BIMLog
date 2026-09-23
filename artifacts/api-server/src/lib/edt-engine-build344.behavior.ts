import assert from "node:assert/strict";
import { deriveEdtActivationCandidate } from "./edt-engine-activation-candidate";
import { requestResolvedEdtActivation, approveResolvedEdtActivation } from "./edt-engine-resolved-activation";
import { BIMLOG_DELIVERY_WORKFLOWS } from "./delivery-workflow-defaults";
import type { ActivatedEdtSource } from "./edt-engine-source-service";
import type { EdtTransactionHost } from "./edt-engine-transaction";

const workflow = BIMLOG_DELIVERY_WORKFLOWS[0];
const source: ActivatedEdtSource = {
  project: { id: 11, code: "P11", name: "Project 11" },
  intake: { id: "intake-1", revision: 4,
    data: { commercial: { contracts: [{ id: "profile-1", contractNumber: "C1", title: "Contract 1" }] },
      scopeItems: [{ id: "scope-1", contractId: "profile-1", deliverableType: "SLEEVE",
        workPackages: [{ id: "wp-1", dimensionType: "floor", dimensionValue: "L2",
          classification: { disciplineId: "trade-1", disciplineCode: "HVAC" } }] }] },
    activationSummary: { configurationSnapshot: { budgetGovernancePolicy: "standard" },
      commercialBaselineFingerprint: "c".repeat(64),
      contracts: [{ profileId: "profile-1", contractId: "contract-1", contractVersionId: "version-1" }] } },
  workItems: [{ id: "wi-1", stableScopeItemId: "scope-1", contractId: "contract-1", contractVersionId: "version-1", status: "active" }],
  canonicalContracts: [{ contractId: "contract-1", versionId: "version-1", currency: "USD", contentFingerprint: "a".repeat(64) }],
  workflowBindings: [{ workItemId: "wi-1", source: "bimlog", versionId: null, templateCode: workflow.code,
    templateVersion: 1, fingerprint: workflow.fingerprint }],
};
const candidate = deriveEdtActivationCandidate(source);
const requestActor = { grants: ["JOB_ACTIVATION_REQUEST"] as const, actorUserId: 3,
  actorCompanyId: 7, actorProjectIds: [11], eligibleRole: "PROJECT_LEADER" };
const approveActor = { grants: ["JOB_ACTIVATION_APPROVE"] as const, actorUserId: 8,
  actorCompanyId: 7, actorProjectIds: [11], eligibleRole: "OPERATIONS_DIRECTOR" };
type RequestRow = { id: string; intake_id: string; company_id: number; project_id: number; intake_revision: number;
  governance_version_id: string; pricing_version_id: string; workflow_version_ids: string[];
  request_fingerprint: string; idempotency_key: string; requested_by_id: number; state: string };
const requests: RequestRow[] = [];
const nodes: string[] = [];
const decisions: Array<{ id: string; request_fingerprint: string; outcome: string }> = [];
let workItemUpdates = 0;
let contractFingerprint = "a".repeat(64);
const queryLog: string[] = [];
const host: EdtTransactionHost = { async connect() { return { async query<Row>(sql: string, values: readonly unknown[] = []) {
  queryLog.push(sql);
  const result = (rows: unknown[] = [], rowCount = rows.length) => ({ rows: rows as Row[], rowCount });
  if (sql.startsWith("BEGIN") || sql === "COMMIT" || sql === "ROLLBACK" || sql.includes("pg_advisory_xact_lock")) return result();
  if (sql.includes("FROM job_intakes")) return result([{ id: source.intake.id, company_id: 7, project_id: 11,
    status: "activated", revision: source.intake.revision, data: source.intake.data,
    activation_summary: source.intake.activationSummary }]);
  if (sql.includes("FROM projects p")) return result([source.project]);
  if (sql.includes("FROM job_activation_work_items")) {
    if (sql.includes("edt_node_id AS")) return result(source.workItems.map(item => ({ id: item.id,
      contractId: item.contractId, stableScopeItemId: item.stableScopeItemId, edtNodeId: null, displayCode: null })));
    return result(source.workItems);
  }
  if (sql.includes("FROM financial_contracts")) return result(source.canonicalContracts!.map(item => ({ ...item, contentFingerprint: contractFingerprint })));
  if (sql.includes("FROM company_delivery_workflow_work_items")) return result(source.workflowBindings!.map(item => ({ ...item, definition: workflow.definition })));
  if (sql.includes("FROM company_master_catalog_entries")) return result([{ id: "trade-1" }]);
  if (sql.includes("FROM job_activation_requests")) {
    if (sql.includes("WHERE id=$1")) return result(requests.filter(item => item.id === values[0]));
    return result(requests.filter(item => item.intake_id === values[0]));
  }
  if (sql.includes("FROM job_activation_edt_nodes")) return result(nodes.map(id => ({ id })).slice(0, 1));
  if (sql.includes("FROM job_activation_decisions")) return result(decisions);
  if (sql.includes("INSERT INTO job_activation_requests")) {
    requests.push({ id: String(values[0]), company_id: Number(values[1]), project_id: Number(values[2]),
      intake_id: String(values[3]), intake_revision: Number(values[4]), governance_version_id: String(values[5]),
      pricing_version_id: String(values[6]), workflow_version_ids: JSON.parse(String(values[7])) as string[],
      request_fingerprint: String(values[8]), idempotency_key: String(values[9]), requested_by_id: Number(values[10]), state: "pending" });
    return result([], 1);
  }
  if (sql.includes("INSERT INTO job_activation_edt_nodes")) { nodes.push(String(values[0])); return result([], 1); }
  if (sql.includes("UPDATE job_activation_work_items SET edt_node_id")) { workItemUpdates++; return result([], 1); }
  if (sql.includes("INSERT INTO job_activation_decisions")) { decisions.push({ id: String(values[0]), request_fingerprint: String(values[4]), outcome: "approved" }); return result([], 1); }
  if (sql.includes("UPDATE job_activation_requests SET state='approved'")) { requests[0].state = "approved"; return result([], 1); }
  throw new Error(`Unexpected EDT test SQL: ${sql}`);
} }; } };

const requestInput = { actor: requestActor, companyId: 7, projectId: 11, intakeId: "intake-1",
  expectedFingerprint: candidate.requestFingerprint, reason: "Create the verified EDT", idempotencyKey: "intake-1-edt" };
await assert.rejects(() => requestResolvedEdtActivation({ ...requestInput, expectedFingerprint: "b".repeat(64) }, host),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_CANDIDATE_STALE");
const first = await requestResolvedEdtActivation(requestInput, host);
assert.equal(first.state, "pending");
assert.equal(requests.length, 1);
assert.equal((await requestResolvedEdtActivation(requestInput, host)).idempotent, true);
const approval = { actor: approveActor, companyId: 7, projectId: 11, requestId: first.id,
  expectedFingerprint: first.fingerprint, reason: "Independent approval" };
await assert.rejects(() => approveResolvedEdtActivation({ ...approval, actor: { ...approveActor, actorUserId: 3 } }, host),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "SELF_APPROVAL_PROHIBITED");
contractFingerprint = "f".repeat(64);
await assert.rejects(() => approveResolvedEdtActivation(approval, host),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_CANDIDATE_STALE");
assert.equal(nodes.length, 0);
assert.equal(workItemUpdates, 0);
contractFingerprint = "a".repeat(64);
const approved = await approveResolvedEdtActivation(approval, host);
assert.equal(approved.idempotent, false);
assert.equal(approved.workItemCount, 1);
assert.equal(nodes.length, candidate.plan.nodes.length);
assert.equal(workItemUpdates, 1);
assert.equal(decisions.length, 1);
assert.equal((await approveResolvedEdtActivation(approval, host)).idempotent, true);
assert.equal(queryLog.filter(sql => sql === "COMMIT").length, 4);
assert.equal(queryLog.filter(sql => sql === "ROLLBACK").length, 3);
console.log("EDT_ENGINE_BUILD344_RESULT=PASS scoped request, stale source denial, independent atomic approval and replay");
