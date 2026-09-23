import assert from "node:assert/strict";
import { loadActivatedEdtSource } from "./edt-engine-source-service";
import { BIMLOG_DELIVERY_WORKFLOWS } from "./delivery-workflow-defaults";
import type { EdtTransactionClient } from "./edt-engine-transaction";

const option = BIMLOG_DELIVERY_WORKFLOWS[0];
let fingerprint = option.fingerprint;
let present = true;
const client: EdtTransactionClient = { async query<Row>(sql: string) {
  if (sql.includes("FROM job_intakes")) return { rows: [{ id: "i", company_id: 7, project_id: 11, status: "activated", revision: 2, data: {}, activation_summary: { contracts: [{ profileId: "A", contractId: "c", contractVersionId: "v" }] } }] as Row[] };
  if (sql.includes("FROM projects")) return { rows: [{ id: 11, code: "P11", name: "Project" }] as Row[] };
  if (sql.includes("FROM job_activation_work_items")) return { rows: [{ id: "w", stableScopeItemId: "s", contractId: "c", contractVersionId: "v", status: "active" }] as Row[] };
  if (sql.includes("FROM financial_contracts")) return { rows: [{ contractId: "c", versionId: "v", currency: "USD", contentFingerprint: "a".repeat(64) }] as Row[] };
  if (sql.includes("FROM company_delivery_workflow_work_items")) return { rows: present ? [{ workItemId: "w", source: "bimlog", versionId: null, templateCode: option.code, templateVersion: 1, definition: option.definition, fingerprint }] as Row[] : [] };
  return { rows: [] };
}, release() {} };
await loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "i" });
fingerprint = "0".repeat(64);
await assert.rejects(() => loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "i" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_WORKFLOW_SOURCE_MISMATCH");
fingerprint = option.fingerprint; present = false;
await assert.rejects(() => loadActivatedEdtSource(client, { companyId: 7, projectId: 11, intakeId: "i" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "EDT_WORKFLOW_SOURCE_MISSING");
console.log("EDT_ENGINE_BUILD332_RESULT=PASS every saved Work Item has a verified activated workflow definition");
