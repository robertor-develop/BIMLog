import assert from "node:assert/strict";
import {
  executeLensNextPhase2SandboxMutation,
  type LensNextMutationAudit,
  type LensNextMutationReceipt,
  type LensNextMutationRow,
  type LensNextMutationStore,
  type LensNextMutationTransaction,
  type LensNextValidatedHeldMutation,
} from "./lens-next-phase2-mutation-executor";
import {
  LENS_NEXT_ACTION_FEATURE_FLAGS,
  LENS_NEXT_PHASE2_MUTATION_CONTRACT_VERSION,
  validateLensNextPhase2Mutation,
  type LensNextPhase2Action,
  type LensNextPhase2MutationRequest,
} from "./lens-next-phase2-mutation-contract";

const actorId = "123e4567-e89b-42d3-a456-426614174000";
const issueFamilyId = "223e4567-e89b-42d3-a456-426614174000";
const digest = "a".repeat(64);
const evidenceHash = "b".repeat(64);

function request(action: LensNextPhase2Action): LensNextPhase2MutationRequest {
  const payload =
    action === "status"
      ? { nextStatus: "resolved" }
      : action === "comment"
        ? { body: "Coordination review complete." }
        : {
            assigneeUserId: "323e4567-e89b-42d3-a456-426614174000",
            responsibleCompanyId: "423e4567-e89b-42d3-a456-426614174000",
          };
  return {
    contractVersion: LENS_NEXT_PHASE2_MUTATION_CONTRACT_VERSION,
    action,
    projectId: 26,
    serverId: 101,
    viewpointId: "vp-immutable-001",
    issueFamilyId,
    lifecycleStatus: "active",
    revisionNumber: 4,
    actorId,
    idempotencyId: `${actorId}:${action}:26:101:4:request-0001`,
    precondition: {
      expectedStatus: "open",
      expectedVersion: 7,
      expectedRevisionNumber: 4,
    },
    permissionEvidence: {
      receiptId: `permission:${action}:receipt-001`,
      receiptSha256: evidenceHash,
      subjectId: actorId,
      action,
      projectId: 26,
      serverId: 101,
      current: true,
      expiresAt: "2026-08-13T00:00:00.000Z",
    },
    pilotPolicy: {
      receiptId: `pilot:${action}:receipt-001`,
      receiptSha256: evidenceHash,
      environment: "sandbox",
      projectId: 26,
      pilotUserId: actorId,
      featureFlag: LENS_NEXT_ACTION_FEATURE_FLAGS[action],
      enabled: true,
      productionWriteAllowed: false,
      expiresAt: "2026-08-13T00:00:00.000Z",
    },
    payload,
  };
}

function held(action: LensNextPhase2Action): LensNextValidatedHeldMutation {
  const value = request(action);
  const validation = validateLensNextPhase2Mutation(value, {
    nowMs: Date.parse("2026-08-12T12:00:00.000Z"),
  });
  assert.equal(validation.ok, true);
  if (!validation.ok) throw new Error("expected a validated held request");
  return { request: value, plan: validation.plan, visualStateDigest: digest };
}

class MemoryStore implements LensNextMutationStore {
  rows = new Map<number, LensNextMutationRow>();
  receipts = new Map<string, LensNextMutationReceipt>();
  audits: LensNextMutationAudit[] = [];
  failAudit = false;
  failReceipt = false;

  constructor() {
    this.rows.set(101, {
      projectId: 26,
      serverId: 101,
      viewpointId: "vp-immutable-001",
      issueFamilyId,
      lifecycleStatus: "active",
      revisionNumber: 4,
      version: 7,
      status: "open",
      visualStateDigest: digest,
      comments: [],
      assigneeUserId: null,
      responsibleCompanyId: null,
    });
  }

  async transaction<T>(
    operation: (tx: LensNextMutationTransaction) => Promise<T>,
  ) {
    const rows = structuredClone(this.rows);
    const receipts = structuredClone(this.receipts);
    const audits = structuredClone(this.audits);
    const tx: LensNextMutationTransaction = {
      findReceipt: async (key) => receipts.get(key) ?? null,
      mutateIfPreconditionsMatch: async ({
        request: value,
        visualStateDigest,
      }) => {
        const row = rows.get(value.serverId);
        if (
          !row ||
          row.projectId !== value.projectId ||
          row.viewpointId !== value.viewpointId ||
          row.issueFamilyId !== value.issueFamilyId ||
          row.lifecycleStatus !== value.lifecycleStatus ||
          row.revisionNumber !== value.precondition.expectedRevisionNumber ||
          row.version !== value.precondition.expectedVersion ||
          row.status !== value.precondition.expectedStatus ||
          row.visualStateDigest !== visualStateDigest
        )
          return null;
        const next: LensNextMutationRow = {
          ...row,
          version: row.version + 1,
          comments: [...row.comments],
        };
        const payload = value.payload as Record<string, string>;
        if (value.action === "status") next.status = payload.nextStatus;
        if (value.action === "comment")
          next.comments = [...next.comments, payload.body];
        if (value.action === "assignment") {
          next.assigneeUserId = payload.assigneeUserId;
          next.responsibleCompanyId = payload.responsibleCompanyId;
        }
        rows.set(value.serverId, next);
        return next;
      },
      appendAudit: async (audit) => {
        if (this.failAudit) throw new Error("synthetic audit failure");
        audits.push(audit);
      },
      saveReceipt: async (receipt) => {
        if (this.failReceipt) throw new Error("synthetic receipt failure");
        if (receipts.has(receipt.scopeKey))
          throw new Error("duplicate receipt");
        receipts.set(receipt.scopeKey, receipt);
      },
    };
    try {
      const result = await operation(tx);
      this.rows = rows;
      this.receipts = receipts;
      this.audits = audits;
      return result;
    } catch (error) {
      throw error;
    }
  }
}

let actionPasses = 0;
for (const action of ["status", "comment", "assignment"] as const) {
  const store = new MemoryStore();
  const first = await executeLensNextPhase2SandboxMutation(held(action), store);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("expected successful first execution");
  assert.equal(first.replayed, false);
  assert.equal(first.productionEnabled, false);
  assert.equal(first.result.visualStateDigest, digest);
  assert.equal(store.rows.size, 1);
  assert.equal(store.audits.length, 1);
  assert.equal(store.receipts.size, 1);
  const replay = await executeLensNextPhase2SandboxMutation(
    held(action),
    store,
  );
  assert.equal(replay.ok, true);
  if (!replay.ok) throw new Error("expected successful replay");
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.receipt, first.receipt);
  assert.deepEqual(replay.result, first.result);
  assert.equal(store.rows.size, 1);
  assert.equal(store.audits.length, 1);
  assert.equal(store.receipts.size, 1);
  actionPasses += 1;
}

const conflictStore = new MemoryStore();
const stale = held("status");
stale.request.precondition.expectedVersion = 6;
const staleResult = await executeLensNextPhase2SandboxMutation(
  stale,
  conflictStore,
);
assert.deepEqual(staleResult, {
  ok: false,
  status: 409,
  code: "PRECONDITION_CONFLICT",
  productionEnabled: false,
  mutationAllowed: false,
});
assert.equal(conflictStore.rows.get(101)?.version, 7);

const mismatchStore = new MemoryStore();
const original = held("comment");
const originalResult = await executeLensNextPhase2SandboxMutation(
  original,
  mismatchStore,
);
assert.equal(originalResult.ok, true);
const mismatch = held("comment");
if (mismatch.request.action === "comment")
  (mismatch.request.payload as { body: string }).body = "Different replay";
const mismatchResult = await executeLensNextPhase2SandboxMutation(
  mismatch,
  mismatchStore,
);
assert.equal(mismatchResult.ok, false);
if (mismatchResult.ok) throw new Error("expected mismatch");
assert.equal(mismatchResult.code, "IDEMPOTENCY_REPLAY_MISMATCH");
assert.equal(mismatchStore.rows.get(101)?.comments.length, 1);

for (const failure of ["audit", "receipt"] as const) {
  const store = new MemoryStore();
  store.failAudit = failure === "audit";
  store.failReceipt = failure === "receipt";
  await assert.rejects(
    executeLensNextPhase2SandboxMutation(held("status"), store),
  );
  assert.equal(store.rows.get(101)?.version, 7);
  assert.equal(store.rows.get(101)?.status, "open");
  assert.equal(store.audits.length, 0);
  assert.equal(store.receipts.size, 0);
}

console.log(
  JSON.stringify({
    result: "PASS",
    actionPasses,
    replayIdempotent: true,
    mismatchedReplayConflicts: true,
    preconditionConflict409: true,
    rollbackCases: 2,
    duplicateRecords: 0,
    productionEnabled: false,
    io: { database: false, network: false, customer: false, provider: false },
  }),
);
