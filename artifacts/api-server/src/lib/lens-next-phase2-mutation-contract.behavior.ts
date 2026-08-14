import assert from "node:assert/strict";
import {
  LENS_NEXT_ACTION_FEATURE_FLAGS,
  LENS_NEXT_PHASE2_MUTATION_CONTRACT_VERSION,
  validateLensNextPhase2Mutation,
} from "./lens-next-phase2-mutation-contract";

const nowMs = Date.parse("2026-08-12T20:15:00.000Z");
const actorId = "11111111-1111-4111-8111-111111111111";

function request(action: "status" | "comment" | "assignment") {
  const payload =
    action === "status"
      ? { nextStatus: "Resolved" }
      : action === "comment"
        ? { body: "Exact pilot comment" }
        : {
            assigneeUserId: "22222222-2222-4222-8222-222222222222",
            responsibleCompanyId: "33333333-3333-4333-8333-333333333333",
          };
  return {
    contractVersion: LENS_NEXT_PHASE2_MUTATION_CONTRACT_VERSION,
    action,
    projectId: 26,
    serverId: 4001,
    viewpointId: "vp-immutable-4001",
    issueFamilyId: "44444444-4444-4444-8444-444444444444",
    lifecycleStatus: "active",
    revisionNumber: 7,
    actorId,
    idempotencyId: `${actorId}:${action}:26:4001:7:request-00000001`,
    precondition: {
      expectedStatus: "Open",
      expectedVersion: 12,
      expectedRevisionNumber: 7,
    },
    permissionEvidence: {
      receiptId: "permission-receipt-0001",
      receiptSha256: "a".repeat(64),
      subjectId: actorId,
      action,
      projectId: 26,
      serverId: 4001,
      current: true,
      expiresAt: "2026-08-12T21:15:00.000Z",
    },
    pilotPolicy: {
      receiptId: "pilot-policy-receipt-01",
      receiptSha256: "b".repeat(64),
      environment: "sandbox",
      projectId: 26,
      pilotUserId: actorId,
      featureFlag: LENS_NEXT_ACTION_FEATURE_FLAGS[action],
      enabled: true,
      productionWriteAllowed: false,
      expiresAt: "2026-08-12T21:15:00.000Z",
    },
    payload,
  };
}

let accepted = 0;
for (const action of ["status", "comment", "assignment"] as const) {
  const result = validateLensNextPhase2Mutation(request(action), { nowMs });
  assert.equal(result.ok, true, `${action} shape must be accepted`);
  if (result.ok) {
    assert.equal(result.plan.mutationAllowed, false);
    assert.equal(result.plan.authorityGranted, false);
    assert.equal(
      result.plan.executionRequirements.zeroUpdatedRowsReturn409,
      true,
    );
    assert.equal(
      result.plan.executionRequirements
        .mutationAuditAndIdempotencyReceiptSingleTransaction,
      true,
    );
    assert.equal(
      result.plan.executionRequirements.visualStateDigestMustRemainUnchanged,
      true,
    );
  }
  accepted += 1;
}

const adversarial: Array<
  [string, (value: ReturnType<typeof request>) => void, string]
> = [
  [
    "caller authority",
    (value) => Object.assign(value, { authority: true }),
    "contract_invalid",
  ],
  [
    "visual camera",
    (value) => Object.assign(value, { camera: {} }),
    "visual_state_forbidden",
  ],
  [
    "label fallback",
    (value) => Object.assign(value, { label: "Open 1" }),
    "visual_state_forbidden",
  ],
  [
    "bad project",
    (value) => Object.assign(value, { projectId: 0 }),
    "identity_invalid",
  ],
  [
    "bad revision",
    (value) => Object.assign(value, { revisionNumber: -1 }),
    "identity_invalid",
  ],
  [
    "bad lifecycle",
    (value) => Object.assign(value, { lifecycleStatus: "deleted" }),
    "identity_invalid",
  ],
  [
    "unscoped idempotency",
    (value) => Object.assign(value, { idempotencyId: "request-0000000001" }),
    "idempotency_invalid",
  ],
  [
    "revision race",
    (value) => Object.assign(value.precondition, { expectedRevisionNumber: 8 }),
    "precondition_invalid",
  ],
  [
    "permission subject",
    (value) =>
      Object.assign(value.permissionEvidence, {
        subjectId: "22222222-2222-4222-8222-222222222222",
      }),
    "permission_evidence_invalid",
  ],
  [
    "permission action",
    (value) => Object.assign(value.permissionEvidence, { action: "comment" }),
    "permission_evidence_invalid",
  ],
  [
    "expired permission",
    (value) =>
      Object.assign(value.permissionEvidence, {
        expiresAt: "2026-08-12T19:00:00.000Z",
      }),
    "permission_evidence_invalid",
  ],
  [
    "wrong flag",
    (value) =>
      Object.assign(value.pilotPolicy, { featureFlag: "lens_next.comments" }),
    "pilot_policy_invalid",
  ],
  [
    "production policy",
    (value) =>
      Object.assign(value.pilotPolicy, { productionWriteAllowed: true }),
    "pilot_policy_invalid",
  ],
  [
    "unapproved environment",
    (value) => Object.assign(value.pilotPolicy, { environment: "production" }),
    "pilot_policy_invalid",
  ],
  [
    "payload unknown",
    (value) => Object.assign(value.payload, { screenshot: "data" }),
    "payload_invalid",
  ],
];

let denied = 0;
for (const [name, mutate, code] of adversarial) {
  const value = request("status");
  mutate(value);
  const result = validateLensNextPhase2Mutation(value, { nowMs });
  assert.equal(result.ok, false, `${name} must be denied`);
  if (!result.ok) assert.equal(result.code, code, name);
  denied += 1;
}

console.log(
  JSON.stringify({
    status: "PASS",
    acceptedShapes: accepted,
    adversarialDenials: denied,
    contractOnly: true,
    mutationAllowed: false,
    authorityGranted: false,
    databaseIo: false,
    networkIo: false,
    providerOrCustomerIo: false,
  }),
);
