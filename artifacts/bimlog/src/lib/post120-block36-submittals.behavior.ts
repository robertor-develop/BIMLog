import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countSubmittalStates,
  filterSubmittals,
  normalizeSubmittalListQuery,
  resolveSubmittalDeepLink,
} from "./submittal-list-query-state";
import {
  buildSubmittalReviewRequest,
  buildSubmittalUpdateRequest,
  mergeAttachment,
  readSubmittalMutationError,
  submittalToEditorForm,
} from "./submittal-editor-contract";
import { createSubmittalHistoryScope, createSubmittalPresentationScope } from "./submittal-presentation-scope";

const now = new Date("2026-09-21T12:00:00.000Z");
const records = [
  { id: 1, projectId: 8, number: "SUB-001", title: "Door hardware", status: "under_review", submittalCategory: "product_data", createdAt: "2026-09-01T12:00:00.000Z", specSection: "08 71 00", manufacturer: "Acme" },
  { id: 2, projectId: 8, number: "SUB-002", title: "Concrete mix", status: "approved", submittalType: "shop_drawing", createdAt: "2026-09-20T12:00:00.000Z", specSection: "03 30 00", manufacturer: null },
];

assert.deepEqual(normalizeSubmittalListQuery({ search: "  door ", status: " under_review " }), { search: "door", status: "under_review", type: "" });
assert.deepEqual(filterSubmittals(records, { search: "ACME", status: "under_review", type: "product_data" }).map((row) => row.id), [1]);
assert.deepEqual(countSubmittalStates(records, now), { pending: 1, approved: 1, actionNeeded: 1 });
assert.equal(resolveSubmittalDeepLink(records, "2")?.number, "SUB-002");
assert.equal(resolveSubmittalDeepLink(records, "bad"), null);

const editor = submittalToEditorForm({
  title: "Door hardware",
  status: "under_review",
  submittalType: "product_data",
  linkedRfiId: 7,
  attachmentsJson: ["/files/one"],
});
const update = buildSubmittalUpdateRequest(editor, "2026-09-21T10:00:00.000Z");
assert.equal(update.expectedUpdatedAt, "2026-09-21T10:00:00.000Z");
assert.equal(update.linkedRfiId, 7);
assert.deepEqual(update.attachmentsJson, ["/files/one"]);
assert.equal(buildSubmittalReviewRequest({ reviewDecision: "approved", complianceNotes: "Reviewed", rejectionReason: "", expectedUpdatedAt: "v1" }).expectedUpdatedAt, "v1");
assert.deepEqual(mergeAttachment(["a", "b"], "b"), ["a", "b"]);
assert.equal(readSubmittalMutationError({ error: { en: "Upload failed safely", es: "Carga fallida" } }, "fallback", "es"), "Carga fallida");

const scope = createSubmittalPresentationScope({ projectId: 8, visibleSubmittalIds: [2, 1, 2], query: { search: " door " } });
assert.deepEqual(scope, { projectId: 8, visibleSubmittalIds: [2, 1], query: { search: "door", status: "", type: "" } });
assert.deepEqual(createSubmittalHistoryScope(8, 2), { projectId: 8, submittalId: 2 });
assert.throws(() => createSubmittalPresentationScope({ projectId: 0, visibleSubmittalIds: [] }), /Invalid submittal project scope/);

const page = readFileSync(new URL("../pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../../api-server/src/routes/submittals.ts", import.meta.url), "utf8");
assert.match(page, /filterSubmittals\(submittals, query\)/);
assert.match(page, /createSubmittalPresentationScope/);
assert.match(page, /submittalToEditorForm\(submittal\)/);
assert.match(page, /buildSubmittalUpdateRequest\(editForm, submittal\.updatedAt\)/);
assert.match(page, /buildSubmittalReviewRequest\(\{ reviewDecision, complianceNotes, rejectionReason, expectedUpdatedAt: submittal\.updatedAt \}\)/);
assert.match(page, /readSubmittalMutationError/);
assert.match(route, /requirePermission\("admin", "write"\)/);
assert.match(route, /code: "SUBMITTAL_STALE_UPDATE"/);
assert.equal((route.match(/rejectStaleSubmittalMutation\(res, body\.expectedUpdatedAt, existing\.updatedAt\)/g) || []).length, 2);
assert.match(route, /where\(and\(eq\(submittalsTable\.id, submittalId\), eq\(submittalsTable\.projectId, projectId\)\)\)\.returning\(\)/);
assert.match(route, /await storage\.delete\(pendingStoragePath\)\.catch/);
assert.match(route, /SUBMITTAL_ATTACHMENT_UPLOAD_FAILED/);

console.log("POST120_BLOCK36=PASS list=query editor=canonical scope=project-bound stale=409 roles=guarded attachments=compensated");
