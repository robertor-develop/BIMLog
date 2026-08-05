import assert from "node:assert/strict";
import express from "express";
import { FinancialControlError } from "./financial-control-contract";
import type { GenericApuBudgetAuthorityService } from "./apu-budget-authority-service";
import { createGenericApuBudgetControlsRouter } from "../routes/generic-apu-budget-controls";

const app = express();
app.use(express.json());
const received: unknown[] = [];
const service: GenericApuBudgetAuthorityService = {
  evaluate: async (input) => {
    received.push(input);
    if (input.actorUserId === 41)
      throw new FinancialControlError(
        403,
        "APU_AUTHORITY_FINANCE_GRANT_REQUIRED",
        "A current Finance grant is required.",
      );
    return {
      control: {
        currency: "USD",
        frozenTemplateVersionId: "template-v1",
        revision: 1,
        idempotencyKey: "request-1",
        roles: [
          {
            roleId: "role-finance",
            currency: "USD",
            balances: {
              approved: "100",
              committed: "80",
              actual: "20",
              projected: "10",
              exposure: "110",
              remaining: "0",
              overrun: "10",
            },
            remainingAvailable: true,
            warning: true,
            state: "APPROVED_OVERRIDE",
            overrunApproval: {
              roleId: "role-finance",
              amount: { amount: "10", currency: "USD" },
              reason: "service reason",
              approver: "user:42:receipt:receipt-1",
              timestamp: "2026-08-05T00:00:00.000Z",
              authorized: true,
            },
          },
        ],
      },
      authorityReceipts: [
        {
          receiptId: "receipt-1",
          idempotencyKey: "request-1",
          roleId: "role-finance",
          approverUserId: 42,
          makerUserId: 7,
          amount: "10",
          currency: "USD",
          approvalReason: "caller supplied reason",
          approvedAt: "2026-08-05T00:00:00.000Z",
          requestFingerprint: "f".repeat(64),
        },
      ],
    };
  },
  reverse: async () => {
    throw new Error("Legacy compatibility proof does not invoke reversal.");
  },
};
app.use(
  createGenericApuBudgetControlsRouter(service, (req, _res, next) => {
    req.user = {
      userId: Number(req.header("x-test-user")),
      email: "test@example.invalid",
      companyId: 1,
      fullName: "Test",
      companyName: "Test",
    };
    next();
  }),
);

const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const url = `http://127.0.0.1:${address.port}/projects/9/financial/generic-apu/apu-v1/budget-control/evaluate`;
const body = {
  approvalReason: "caller supplied reason",
  control: {
    currency: "USD",
    frozenTemplateVersionId: "template-v1",
    currentRevision: 1,
    expectedRevision: 1,
    idempotencyKey: "request-1",
    roles: [
      {
        roleId: "role-finance",
        committed: { amount: "80", currency: "USD" },
        actual: { amount: "20", currency: "USD" },
        projected: { amount: "10", currency: "USD" },
      },
    ],
  },
};

const denied = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "x-test-user": "41" },
  body: JSON.stringify(body),
});
assert.equal(denied.status, 403);
assert.equal(
  ((await denied.json()) as any).code,
  "APU_AUTHORITY_FINANCE_GRANT_REQUIRED",
);
const approved = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "x-test-user": "42" },
  body: JSON.stringify(body),
});
assert.equal(approved.status, 200);
const payload = (await approved.json()) as any;
assert.equal(payload.control.roles[0].state, "APPROVED_OVERRIDE");
assert.equal(
  payload.control.roles[0].overrunApproval.approver,
  "user:42:receipt:receipt-1",
);
assert.equal(payload.authorityReceipts[0].makerUserId, 7);
assert.equal(payload.authorityReceipts[0].approvalReason, body.approvalReason);
assert.equal((received[0] as any).actorUserId, 41);
assert.equal((received[1] as any).actorUserId, 42);

console.log(
  JSON.stringify(
    {
      suite: "generic-apu-budget-authority-http",
      status: "passed",
      checks: [
        "authenticated actor bound by middleware",
        "caller authorization denied without Finance grant",
        "new service-object router interface remains compatible",
      ],
    },
    null,
    2,
  ),
);
await new Promise<void>((resolve) => server.close(() => resolve()));
