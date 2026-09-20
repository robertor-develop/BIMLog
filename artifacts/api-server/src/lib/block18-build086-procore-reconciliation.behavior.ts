import assert from "node:assert/strict";
import { reconcileProcorePage } from "./block18-build086-procore-reconciliation";

const record = { providerRfiId: "rfi-44", providerRevision: 2, sourceSha256: "a".repeat(64), attachments: [{ providerAttachmentId: "att-1", fileName: "evidence.pdf", byteSize: 42, sha256: "b".repeat(64) }] };
const page = { projectId: 26, companyId: 9, cursor: "cursor-1", nextCursor: "cursor-2", records: [record] };
assert.deepEqual(reconcileProcorePage(page, new Map()).actions.map((item) => item.outcome), ["import"]);
assert.deepEqual(reconcileProcorePage(page, new Map([["9:26:rfi-44:2", "a".repeat(64)]])).actions.map((item) => item.outcome), ["replay"]);
assert.throws(() => reconcileProcorePage(page, new Map([["9:26:rfi-44:2", "c".repeat(64)]])), /REVISION_CONFLICT/);
assert.throws(() => reconcileProcorePage({ ...page, nextCursor: "cursor-1" }, new Map()), /CURSOR_DID_NOT_ADVANCE/);
assert.throws(() => reconcileProcorePage({ ...page, records: [record, record] }, new Map()), /DUPLICATE_RFI_IDENTITY/);
assert.throws(() => reconcileProcorePage({ ...page, records: [{ ...record, attachments: [record.attachments[0], record.attachments[0]] }] }, new Map()), /DUPLICATE_ATTACHMENT_IDENTITY/);

const staged: string[] = [];
try {
  for (const action of reconcileProcorePage(page, new Map()).actions) staged.push(action.identity);
  throw new Error("SYNTHETIC_PROVIDER_FAILURE");
} catch {
  staged.length = 0;
}
assert.deepEqual(staged, []);
console.log("block18 build086 procore reconciliation: PASS");
