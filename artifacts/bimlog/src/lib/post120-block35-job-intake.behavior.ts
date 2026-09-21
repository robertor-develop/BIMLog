import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertVisibleAiCostGate,
  buildJobIntakeMappingRequest,
  defaultJobIntakeMappingForm,
  jobIntakeDocumentAssistance,
} from "./job-intake-document-contract";
import {
  blankJobIntakeData,
  jobIntakeStages,
  resolveJobIntakeRecovery,
} from "./job-intake-workspace-state";

assert.deepEqual(jobIntakeStages, ["documents", "identity", "contract", "scope", "delivery", "team", "review"]);
assert.equal(blankJobIntakeData.identity.currency, "USD");
const server = { identity: { jobName: "Saved" } };
const partial = { identity: { jobName: "Recovered partial" } };
assert.deepEqual(resolveJobIntakeRecovery(4, server, { revision: 4, data: partial }), {
  resume: true,
  data: partial,
  discardStale: false,
});
assert.equal(resolveJobIntakeRecovery(5, server, { revision: 4, data: partial }).discardStale, true);
assert.equal(resolveJobIntakeRecovery(4, server, { revision: 4, data: server }).resume, false);

const spreadsheet = { id: "doc-1", extractionSummary: { sheets: [{ name: "Estimate", rowCount: 3, columnCount: 2 }] } };
assert.deepEqual(defaultJobIntakeMappingForm(spreadsheet), { sheetName: "Estimate", headerRow: 1, nameColumn: 0, quantityColumn: 1 });
assert.deepEqual(buildJobIntakeMappingRequest({ sheetName: "Estimate", headerRow: 2, nameColumn: 3, quantityColumn: 4 }), { sheetName: "Estimate", headerRow: 2, nameColumn: 3, quantityColumn: 4 });
assert.deepEqual(jobIntakeDocumentAssistance(spreadsheet), { mode: "deterministic_spreadsheet", readsFile: true, usesAi: false, estimatedCostMicros: 0 });
assert.equal(jobIntakeDocumentAssistance({ id: "doc-2" }).mode, "manual_evidence");

assert.throws(() => assertVisibleAiCostGate({ operation: "file_read", fundingSourceVisible: false, estimateVisible: true, confirmationGranted: true }), /JOB_INTAKE_AI_COST_GATE_REQUIRED/);
assert.throws(() => assertVisibleAiCostGate({ operation: "file_read", fundingSourceVisible: true, estimateVisible: false, confirmationGranted: true }), /JOB_INTAKE_AI_COST_GATE_REQUIRED/);
assert.throws(() => assertVisibleAiCostGate({ operation: "file_read", fundingSourceVisible: true, estimateVisible: true, confirmationGranted: false }), /JOB_INTAKE_AI_COST_GATE_REQUIRED/);
assert.equal(assertVisibleAiCostGate({ operation: "text_assist", fundingSourceVisible: true, estimateVisible: true, confirmationGranted: true }).operation, "text_assist");

const workspace = readFileSync(new URL("../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
assert.match(workspace, /resolveJobIntakeRecovery\(current\.revision, current\.data, recovered\)/);
assert.match(workspace, /preserveJobIntakeRecovery\(projectId, revisionRef\.current, data\)/);
assert.match(workspace, /pendingSaveRef\.current = dataRef\.current/);
assert.match(workspace, /setSaveState\("error"\)/);
assert.match(workspace, /prepareJobIntakeUpload\(form, saved\.revision\)/);
assert.match(workspace, /Document assistance cost boundary/);
assert.match(workspace, /0 AI credits/);
assert.match(workspace, /catch \(cause\) \{\s*setError\(cause instanceof Error \? cause\.message : String\(cause\)\);\s*setBusy\(false\);\s*\}/);

console.log("POST120_BLOCK35=PASS schema=form-state documents=bounded ai-cost=visible recovery=preserved failures=retained");
