import assert from "node:assert/strict";
import express from "express";
import type {
  GenericApuAuthorityBinding,
  GenericApuAuthorityReceipt,
  GenericApuAuthorityReversalReceipt,
  GenericApuAuthorityStoredReceipt,
  GenericApuBudgetAuthorityDependencies,
  GenericApuBudgetAuthorityTransaction,
} from "./apu-budget-authority-service";

process.env.PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ?? "postgresql://apu-test:apu-test@127.0.0.1:1/apu-test";
const { FinancialControlError } = await import("./financial-control-contract");
const { createGenericApuBudgetAuthorityService } = await import("./apu-budget-authority-service");
const { createGenericApuBudgetControlsRouter } = await import("../routes/generic-apu-budget-controls");

type JournalEvent =
  | Readonly<{ kind: "approval"; receipt: GenericApuAuthorityStoredReceipt }>
  | Readonly<{ kind: "reversal"; receipt: GenericApuAuthorityReversalReceipt }>;

interface AuthorityState {
  readonly approvalsByEntity: Map<string, GenericApuAuthorityStoredReceipt>;
  readonly approvalsById: Map<string, GenericApuAuthorityStoredReceipt>;
  readonly reversalsByOriginal: Map<string, GenericApuAuthorityReversalReceipt>;
  journal: readonly JournalEvent[];
}

const binding: GenericApuAuthorityBinding = Object.freeze({
  projectApuVersionId: "apu-v1",
  projectId: 9,
  companyId: 3,
  templateVersionId: "template-v1",
  revision: 4,
  currency: "USD",
  makerUserId: 7,
  status: "overrun_review_required",
  authoritativeRoleCaps: Object.freeze([
    Object.freeze({
      roleId: "role-finance",
      approved: Object.freeze({ amount: "100", currency: "USD" }),
      warningRemaining: Object.freeze({ amount: "5", currency: "USD" }),
    }),
  ]),
});

let state: AuthorityState = {
  approvalsByEntity: new Map(),
  approvalsById: new Map(),
  reversalsByOriginal: new Map(),
  journal: Object.freeze([]),
};
const transactionStats = { started: 0, committed: 0, rolledBack: 0 };
const overrunAuthorizations: Array<Record<string, unknown>> = [];
const reversalAuthorizations: Array<Record<string, unknown>> = [];
const observedActors: number[] = [];
let clockTick = 0;

function cloneState(source: AuthorityState): AuthorityState {
  return {
    approvalsByEntity: new Map(source.approvalsByEntity),
    approvalsById: new Map(source.approvalsById),
    reversalsByOriginal: new Map(source.reversalsByOriginal),
    journal: [...source.journal],
  };
}

function conflict(code: string, message: string): never {
  throw new FinancialControlError(409, code, message);
}

function dependenciesFor(
  working: AuthorityState,
): GenericApuBudgetAuthorityDependencies {
  return {
    now: () => new Date(Date.UTC(2026, 7, 5, 12, 0, clockTick++)),
    loadBinding: async (projectId, projectApuVersionId) =>
      projectId === binding.projectId &&
      projectApuVersionId === binding.projectApuVersionId
        ? binding
        : null,
    authorizeOverrun: async (input) => {
      observedActors.push(input.actorUserId);
      overrunAuthorizations.push(input);
      if (input.actorUserId === 41)
        throw new FinancialControlError(
          403,
          "APU_AUTHORITY_FINANCE_GRANT_REQUIRED",
          "A current Finance grant is required.",
        );
      return { companyId: input.actorUserId === 45 ? 999 : binding.companyId };
    },
    appendReceipt: async (receipt) => {
      const entityId = `${binding.projectApuVersionId}:${receipt.roleId}:${receipt.idempotencyKey}`;
      const prior = working.approvalsByEntity.get(entityId);
      if (prior) {
        if (working.reversalsByOriginal.has(prior.receiptId))
          conflict(
            "APU_AUTHORITY_OVERRIDE_REVERSED",
            "The issued override was reversed.",
          );
        if (
          prior.approverUserId !== receipt.approverUserId ||
          prior.idempotencyKey !== receipt.idempotencyKey ||
          prior.requestFingerprint !== receipt.requestFingerprint ||
          prior.approvalReason !== receipt.approvalReason
        )
          conflict(
            "APU_AUTHORITY_IDEMPOTENCY_CONFLICT",
            "The idempotency key is bound to another approval request.",
          );
        return prior;
      }
      const stored: GenericApuAuthorityStoredReceipt = Object.freeze({
        ...receipt,
        projectId: binding.projectId,
        companyId: binding.companyId,
        projectApuVersionId: binding.projectApuVersionId,
        entityId,
      });
      working.approvalsByEntity.set(entityId, stored);
      working.approvalsById.set(stored.receiptId, stored);
      working.journal = Object.freeze([
        ...working.journal,
        Object.freeze({ kind: "approval" as const, receipt: stored }),
      ]);
      return stored;
    },
    loadReceipt: async ({ projectId, projectApuVersionId, receiptId }) => {
      const receipt = working.approvalsById.get(receiptId);
      return receipt?.projectId === projectId &&
        receipt.projectApuVersionId === projectApuVersionId
        ? receipt
        : null;
    },
    authorizeReversal: async (input) => {
      observedActors.push(input.actorUserId);
      reversalAuthorizations.push(input);
      if (input.actorUserId === 41)
        throw new FinancialControlError(
          403,
          "APU_AUTHORITY_FINANCE_GRANT_REQUIRED",
          "A current Finance grant is required.",
        );
      return { companyId: input.actorUserId === 45 ? 999 : binding.companyId };
    },
    appendReversal: async (receipt) => {
      const prior = working.reversalsByOriginal.get(receipt.originalReceiptId);
      if (prior) {
        if (
          prior.actorUserId !== receipt.actorUserId ||
          prior.requestFingerprint !== receipt.requestFingerprint
        )
          conflict(
            "APU_AUTHORITY_REVERSAL_CONFLICT",
            "The override was already reversed by another request.",
          );
        return prior;
      }
      const immutable = Object.freeze({ ...receipt });
      working.reversalsByOriginal.set(receipt.originalReceiptId, immutable);
      working.journal = Object.freeze([
        ...working.journal,
        Object.freeze({ kind: "reversal" as const, receipt: immutable }),
      ]);
      return immutable;
    },
  };
}

const transaction: GenericApuBudgetAuthorityTransaction = {
  async run<T>(
    work: (dependencies: GenericApuBudgetAuthorityDependencies) => Promise<T>,
  ): Promise<T> {
    transactionStats.started += 1;
    const working = cloneState(state);
    try {
      const result = await work(dependenciesFor(working));
      state = working;
      transactionStats.committed += 1;
      return result;
    } catch (error) {
      transactionStats.rolledBack += 1;
      throw error;
    }
  },
};

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use(
  createGenericApuBudgetControlsRouter(
    createGenericApuBudgetAuthorityService(transaction),
    (req, _res, next) => {
      const actorUserId = Number(req.header("x-test-user"));
      if (Number.isSafeInteger(actorUserId) && actorUserId > 0)
        req.user = {
          userId: actorUserId,
          email: "synthetic@example.invalid",
          companyId: binding.companyId,
          fullName: "Synthetic actor",
          companyName: "Synthetic company",
        };
      next();
    },
  ),
);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/projects/9/financial/generic-apu/apu-v1/budget-control`;

const role = () => ({
  roleId: "role-finance",
  committed: { amount: "80", currency: "USD" },
  actual: { amount: "20", currency: "USD" },
  projected: { amount: "10", currency: "USD" },
});
const evaluationBody = (overrides: Record<string, unknown> = {}) => ({
  approvalReason: "Authorized synthetic overrun",
  control: {
    currency: "USD",
    frozenTemplateVersionId: "template-v1",
    currentRevision: 4,
    expectedRevision: 4,
    idempotencyKey: "evaluation-1",
    roles: [role()],
  },
  ...overrides,
});

async function post(path: string, actorUserId: number | null, body: unknown) {
  return fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(actorUserId === null ? {} : { "x-test-user": String(actorUserId) }),
    },
    body: JSON.stringify(body),
  });
}

async function expectCode(
  response: Response,
  status: number,
  code: string,
): Promise<void> {
  assert.equal(response.status, status);
  assert.equal(((await response.json()) as { code?: string }).code, code);
}

try {
  const beforeRouteRejects = { ...transactionStats };
  await expectCode(
    await post(`${base}/evaluate`, null, evaluationBody()),
    401,
    "APU_AUTHENTICATION_REQUIRED",
  );
  await expectCode(
    await post(
      `${base}/evaluate`,
      42,
      evaluationBody({ callerAuthority: true }),
    ),
    400,
    "APU_AUTHORITY_PAYLOAD_CLOSED",
  );
  assert.deepEqual(
    transactionStats,
    beforeRouteRejects,
    "route-level authentication and closed-body failures never entered a transaction",
  );

  const callerCap = evaluationBody() as any;
  callerCap.control.roles[0].approved = { amount: "999999", currency: "USD" };
  await expectCode(
    await post(`${base}/evaluate`, 42, callerCap),
    400,
    "APU_AUTHORITY_PAYLOAD_CLOSED",
  );

  const tooManyRoles = evaluationBody() as any;
  tooManyRoles.control.roles = Array.from({ length: 101 }, (_, index) => ({
    ...role(),
    roleId: `role-${index}`,
  }));
  await expectCode(
    await post(`${base}/evaluate`, 42, tooManyRoles),
    400,
    "APU_AUTHORITY_ROLES_BOUNDED",
  );

  const wrongRole = evaluationBody() as any;
  wrongRole.control.roles = [{ ...role(), roleId: "role-attacker" }];
  await expectCode(
    await post(`${base}/evaluate`, 42, wrongRole),
    409,
    "APU_AUTHORITY_ROLE_SET_MISMATCH",
  );
  assert.equal(
    state.journal.length,
    0,
    "rejected payloads rolled back without journal writes",
  );

  await expectCode(
    await post(`${base}/evaluate`, binding.makerUserId, evaluationBody()),
    403,
    "APU_AUTHORITY_MAKER_CHECKER_REQUIRED",
  );
  await expectCode(
    await post(`${base}/evaluate`, 41, evaluationBody()),
    403,
    "APU_AUTHORITY_FINANCE_GRANT_REQUIRED",
  );
  await expectCode(
    await post(`${base}/evaluate`, 45, evaluationBody()),
    409,
    "APU_AUTHORITY_COMPANY_SCOPE_MISMATCH",
  );
  assert.equal(
    state.journal.length,
    0,
    "maker/checker, Finance, and authoritative company-scope failures rolled back before journaling",
  );

  const approved = await post(`${base}/evaluate`, 42, evaluationBody());
  assert.equal(approved.status, 200);
  const approvalPayload = (await approved.json()) as any;
  assert.equal(approvalPayload.control.roles[0].balances.approved, "100");
  assert.equal(approvalPayload.control.roles[0].balances.overrun, "10");
  assert.equal(approvalPayload.control.roles[0].state, "APPROVED_OVERRIDE");
  assert.equal(approvalPayload.authorityReceipts.length, 1);
  assert.equal(
    approvalPayload.authorityReceipts[0].approvalReason,
    "Authorized synthetic overrun",
  );
  const receiptId = String(approvalPayload.authorityReceipts[0].receiptId);
  assert.match(receiptId, /^[0-9a-f-]{36}$/i);
  assert.equal(overrunAuthorizations.at(-1)?.actorUserId, 42);
  assert.deepEqual(overrunAuthorizations.at(-1)?.roleCap, {
    amount: "100",
    currency: "USD",
  });
  assert.equal(state.journal.length, 1);
  assert.equal(
    (state.journal[0] as Extract<JournalEvent, { kind: "approval" }>).receipt
      .approvalReason,
    "Authorized synthetic overrun",
  );

  const replay = await post(`${base}/evaluate`, 42, evaluationBody());
  assert.equal(replay.status, 200);
  const replayPayload = (await replay.json()) as any;
  assert.equal(replayPayload.authorityReceipts[0].receiptId, receiptId);
  assert.equal(
    replayPayload.authorityReceipts[0].approvalReason,
    "Authorized synthetic overrun",
  );
  assert.equal(
    state.journal.length,
    1,
    "idempotent replay reused the immutable approval receipt",
  );

  const conflictBody = evaluationBody() as any;
  conflictBody.approvalReason =
    "Changed request under the same idempotency key";
  await expectCode(
    await post(`${base}/evaluate`, 42, conflictBody),
    409,
    "APU_AUTHORITY_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(
    state.journal.length,
    1,
    "approval idempotency conflict rolled back",
  );

  const reversalUrl = `${base}/overrides/${receiptId}/reverse`;
  const reversalBody = {
    reason: "Correction approved by Finance",
    idempotencyKey: "reversal-1",
  };
  const transactionsBeforeClosedReversal = { ...transactionStats };
  await expectCode(
    await post(reversalUrl, 43, { ...reversalBody, deleteOriginal: true }),
    400,
    "APU_AUTHORITY_PAYLOAD_CLOSED",
  );
  assert.deepEqual(transactionStats, transactionsBeforeClosedReversal);
  await expectCode(
    await post(reversalUrl, binding.makerUserId, reversalBody),
    403,
    "APU_AUTHORITY_MAKER_CHECKER_REQUIRED",
  );
  await expectCode(
    await post(reversalUrl, 41, reversalBody),
    403,
    "APU_AUTHORITY_FINANCE_GRANT_REQUIRED",
  );
  await expectCode(
    await post(reversalUrl, 45, reversalBody),
    409,
    "APU_AUTHORITY_COMPANY_SCOPE_MISMATCH",
  );
  assert.equal(
    state.journal.length,
    1,
    "rejected reversals, including company-scope mismatch, rolled back before a reversal journal event",
  );

  const reversed = await post(reversalUrl, 43, reversalBody);
  assert.equal(reversed.status, 200);
  const reversalReceipt =
    (await reversed.json()) as GenericApuAuthorityReversalReceipt;
  assert.equal(reversalReceipt.originalReceiptId, receiptId);
  assert.equal(reversalReceipt.actorUserId, 43);
  assert.equal(reversalReceipt.makerUserId, binding.makerUserId);
  assert.equal(reversalReceipt.amount, "10");
  assert.equal(reversalAuthorizations.at(-1)?.roleId, "role-finance");
  assert.deepEqual(
    state.journal.map((event) => event.kind),
    ["approval", "reversal"],
  );
  assert.equal(
    (state.journal[1] as Extract<JournalEvent, { kind: "reversal" }>).receipt
      .originalReceiptId,
    receiptId,
  );

  const reversalReplay = await post(reversalUrl, 43, reversalBody);
  assert.equal(reversalReplay.status, 200);
  assert.equal(
    ((await reversalReplay.json()) as any).reversalReceiptId,
    reversalReceipt.reversalReceiptId,
  );
  assert.equal(
    state.journal.length,
    2,
    "reversal replay reused the linked immutable journal event",
  );

  await expectCode(
    await post(reversalUrl, 43, {
      ...reversalBody,
      reason: "Conflicting reversal reason",
    }),
    409,
    "APU_AUTHORITY_REVERSAL_CONFLICT",
  );
  await expectCode(
    await post(`${base}/evaluate`, 42, evaluationBody()),
    409,
    "APU_AUTHORITY_OVERRIDE_REVERSED",
  );
  assert.equal(
    state.journal.length,
    2,
    "conflicts after reversal rolled back and retained both immutable events",
  );

  assert.ok(
    transactionStats.committed >= 4,
    "successful evaluation, replay, reversal, and reversal replay committed",
  );
  assert.ok(
    transactionStats.rolledBack >= 8,
    "service failures exercised transaction rollback",
  );
  assert.equal(
    transactionStats.started,
    transactionStats.committed + transactionStats.rolledBack,
  );
  assert.ok(
    observedActors.includes(42) && observedActors.includes(43),
    "authenticated route actors reached real authorization dependencies",
  );

  console.log(
    JSON.stringify(
      {
        suite: "generic-apu-budget-authority-real-boundary",
        status: "passed",
        checks: [
          "real route invokes dependency-bound service and evaluator",
          "authoritative project/version role caps replace caller authority",
          "closed payloads, exact role set, and 100-role bound",
          "maker-checker and Finance authorization",
          "idempotent immutable approval journal receipt",
          "durable approval reason survives journal storage and replay",
          "authoritative company-scope mismatch rolls back before journal",
          "audited linked override reversal and replay conflict",
          "transaction commit and rollback controls",
        ],
        transactions: transactionStats,
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
