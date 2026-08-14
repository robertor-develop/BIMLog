import assert from "node:assert/strict";
import {
  evaluateLensNextPhase2Capability,
  type LensNextPhase2Action,
  type LensNextPhase2CapabilityInput,
} from "../../src/features/lens-next/lens-next-phase2-capability";

const actionRequirements = {
  status: ["lens_next.status_updates", "lens_next.status.write"],
  comment: ["lens_next.comments", "lens_next.comment.write"],
  assignment: [
    "lens_next.platform_metadata_writes",
    "lens_next.assignment.write",
  ],
} as const;

const sha = "a".repeat(64);
const receiptSha = "b".repeat(64);

function approved(action: LensNextPhase2Action): LensNextPhase2CapabilityInput {
  const [flag, permission] = actionRequirements[action];
  return {
    contractVersion: "lens-next-phase2-capability.v1",
    evaluatedAt: "2026-08-12T12:00:00.000Z",
    action,
    environment: "pilot",
    actionFlag: {
      key: flag,
      enabled: true,
      receiptId: `flag:${action}:receipt-001`,
      version: 1,
      current: true,
    },
    policy: {
      receiptId: "policy:pilot:receipt-001",
      receiptSha256: receiptSha,
      version: 1,
      environment: "pilot",
      projectId: 26,
      approvedPilotUserId: 91,
      approved: true,
      current: true,
      productionWriteAllowed: false,
      expiresAt: "2026-08-12T13:00:00.000Z",
    },
    session: {
      sessionId: "session:ephemeral:001",
      actorUserId: 91,
      projectId: 26,
      modelFingerprint: sha,
      active: true,
    },
    identity: {
      projectId: 26,
      serverId: 101,
      viewpointId: "123e4567-e89b-42d3-a456-426614174000",
      issueFamilyId: "223e4567-e89b-42d3-a456-426614174000",
      lifecycleStatus: "active",
      revisionNumber: 4,
      modelFingerprint: sha,
    },
    preconditions: {
      issueFamilyId: "223e4567-e89b-42d3-a456-426614174000",
      expectedStatus: "open",
      expectedVersion: 7,
      expectedRevisionNumber: 4,
    },
    permissionEvidence: {
      receiptId: `permission:${action}:receipt-001`,
      receiptSha256: receiptSha,
      actorUserId: 91,
      projectId: 26,
      serverId: 101,
      capability: permission,
      granted: true,
      current: true,
      expiresAt: "2026-08-12T12:30:00.000Z",
    },
    idempotency: {
      id: `actor91:project26:${action}:request-0001`,
      actorUserId: 91,
      projectId: 26,
      serverId: 101,
      revisionNumber: 4,
      action,
    },
    visualState: { digestBefore: sha, digestAfter: sha },
  };
}

let acceptedContracts = 0;
let enabledContracts = 0;
let adversarialDenials = 0;

for (const action of ["status", "comment", "assignment"] as const) {
  const withoutExecutor = evaluateLensNextPhase2Capability(approved(action));
  assert.equal(withoutExecutor.contractReady, true);
  assert.equal(withoutExecutor.enabled, false);
  assert.equal(withoutExecutor.dispatchAllowed, false);
  assert.equal(withoutExecutor.mutationAllowed, false);
  assert.deepEqual(withoutExecutor.reasons, ["SERVER_EXECUTOR_NOT_BOUND"]);
  acceptedContracts += 1;

  const withExecutor = approved(action);
  withExecutor.serverExecutor = {
    action,
    endpointContractId: `executor:${action}:v1`,
    endpointPath: `/api/projects/{projectId}/lens-next/${action}`,
    receiptId: `executor:${action}:receipt-001`,
    receiptSha256: receiptSha,
    trustedSource: "server_runtime",
    current: true,
    expiresAt: "2026-08-12T12:30:00.000Z",
    attestation: {
      atomicExpectedStatusVersionRevisionPredicate: true,
      zeroRowsConflictStatus: 409,
      auditAndIdempotencySameTransaction: true,
      exactResultIdentityVersionResponse: true,
      visualDigestInvariant: true,
      fallbackMatchingAllowed: false,
      autoConflictResolutionAllowed: false,
      projectId: 26,
      serverId: 101,
      viewpointId: "123e4567-e89b-42d3-a456-426614174000",
      issueFamilyId: "223e4567-e89b-42d3-a456-426614174000",
      expectedStatus: "open",
      expectedVersion: 7,
      expectedRevisionNumber: 4,
      idempotencyId: `actor91:project26:${action}:request-0001`,
      visualStateDigest: sha,
    },
  };
  const enabled = evaluateLensNextPhase2Capability(withExecutor);
  assert.equal(enabled.contractReady, true);
  assert.equal(enabled.serverExecutorBound, true);
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.dispatchAllowed, true);
  assert.equal(enabled.mutationAllowed, false);
  assert.equal(enabled.visualMutationAllowed, false);
  assert.equal(enabled.persistentTokenStoreAllowed, false);
  assert.equal(enabled.conflictAutoResolutionAllowed, false);
  enabledContracts += 1;
}

function denied(
  mutate: (
    input: LensNextPhase2CapabilityInput & Record<string, unknown>,
  ) => void,
  reason: string,
) {
  const input = approved("status") as LensNextPhase2CapabilityInput &
    Record<string, unknown>;
  mutate(input);
  const result = evaluateLensNextPhase2Capability(input);
  assert.equal(result.enabled, false);
  assert.equal(result.dispatchAllowed, false);
  assert.equal(result.mutationAllowed, false);
  assert.ok(
    result.reasons.some((item) => item.includes(reason)),
    result.reasons.join(", "),
  );
  adversarialDenials += 1;
}

denied((input) => (input.environment = "production"), "PRODUCTION");
denied((input) => (input.actionFlag.enabled = false), "ACTION_FLAG_NOT");
denied(
  (input) => (input.actionFlag.key = "lens_next.comments"),
  "FLAG_MISMATCH",
);
denied((input) => (input.policy.approved = false), "POLICY_INVALID");
denied((input) => (input.session.active = false), "SESSION_CONTEXT");
denied((input) => (input.session.projectId = 27), "BINDING_MISMATCH");
denied(
  (input) => (input.identity.lifecycleStatus = "superseded"),
  "IDENTITY_INVALID",
);
denied((input) => (input.identity.revisionNumber = 0), "IDENTITY_INVALID");
denied((input) => (input.permissionEvidence.granted = false), "PERMISSION");
denied((input) => (input.permissionEvidence.actorUserId = 92), "PERMISSION");
denied((input) => (input.idempotency.actorUserId = 92), "IDEMPOTENCY");
denied(
  (input) => (input.visualState.digestAfter = "b".repeat(64)),
  "VISUAL_STATE",
);
denied((input) => (input.label = "Open Viewpoint"), "FIELD_FORBIDDEN");
denied((input) => (input.folderPath = "Open/Floor 1"), "FIELD_FORBIDDEN");
denied((input) => (input.treePosition = 2), "FIELD_FORBIDDEN");
denied((input) => (input.activeViewpoint = true), "FIELD_FORBIDDEN");
denied((input) => (input.authorityGranted = true), "FIELD_FORBIDDEN");
denied(
  (input) => (input.persistentTokenStore = "localStorage"),
  "FIELD_FORBIDDEN",
);
denied((input) => (input.autoResolveConflict = true), "FIELD_FORBIDDEN");
denied((input) => (input.policy.receiptSha256 = "bad"), "POLICY_INVALID");
denied(
  (input) =>
    ((input.policy as unknown as Record<string, unknown>)[
      "productionWriteAllowed"
    ] = true),
  "POLICY_INVALID",
);
denied(
  (input) => (input.policy.expiresAt = input.evaluatedAt),
  "POLICY_INVALID",
);
denied(
  (input) =>
    (input.preconditions.issueFamilyId =
      "323e4567-e89b-42d3-a456-426614174000"),
  "PRECONDITIONS_INVALID",
);
denied(
  (input) => (input.preconditions.expectedVersion = 0),
  "PRECONDITIONS_INVALID",
);
denied(
  (input) => (input.preconditions.expectedRevisionNumber = 3),
  "PRECONDITIONS_INVALID",
);
denied(
  (input) => (input.permissionEvidence.receiptSha256 = "bad"),
  "PERMISSION",
);
denied((input) => (input.permissionEvidence.serverId = 102), "PERMISSION");
denied(
  (input) => (input.permissionEvidence.expiresAt = input.evaluatedAt),
  "PERMISSION",
);
denied((input) => (input.idempotency.serverId = 102), "IDEMPOTENCY");
denied((input) => (input.idempotency.revisionNumber = 3), "IDEMPOTENCY");

function executorDenied(
  mutate: (
    executor: NonNullable<LensNextPhase2CapabilityInput["serverExecutor"]>,
  ) => void,
) {
  const input = approved("status");
  input.serverExecutor = {
    action: "status",
    endpointContractId: "executor:status:v1",
    endpointPath: "/api/projects/{projectId}/lens-next/status",
    receiptId: "executor:status:receipt-001",
    receiptSha256: receiptSha,
    trustedSource: "server_runtime",
    current: true,
    expiresAt: "2026-08-12T12:30:00.000Z",
    attestation: {
      atomicExpectedStatusVersionRevisionPredicate: true,
      zeroRowsConflictStatus: 409,
      auditAndIdempotencySameTransaction: true,
      exactResultIdentityVersionResponse: true,
      visualDigestInvariant: true,
      fallbackMatchingAllowed: false,
      autoConflictResolutionAllowed: false,
      projectId: 26,
      serverId: 101,
      viewpointId: "123e4567-e89b-42d3-a456-426614174000",
      issueFamilyId: "223e4567-e89b-42d3-a456-426614174000",
      expectedStatus: "open",
      expectedVersion: 7,
      expectedRevisionNumber: 4,
      idempotencyId: "actor91:project26:status:request-0001",
      visualStateDigest: sha,
    },
  };
  mutate(input.serverExecutor);
  const result = evaluateLensNextPhase2Capability(input);
  assert.equal(result.dispatchAllowed, false);
  assert.equal(result.mutationAllowed, false);
  assert.ok(result.reasons.includes("SERVER_EXECUTOR_BINDING_INVALID"));
  adversarialDenials += 1;
}

executorDenied((executor) => (executor.receiptSha256 = "bad"));
executorDenied((executor) => (executor.expiresAt = "2026-08-12T11:59:00.000Z"));
executorDenied(
  (executor) =>
    ((executor.attestation as unknown as Record<string, unknown>)[
      "atomicExpectedStatusVersionRevisionPredicate"
    ] = false),
);
executorDenied(
  (executor) =>
    ((executor.attestation as unknown as Record<string, unknown>)[
      "zeroRowsConflictStatus"
    ] = 200),
);
executorDenied(
  (executor) =>
    ((executor.attestation as unknown as Record<string, unknown>)[
      "auditAndIdempotencySameTransaction"
    ] = false),
);
executorDenied(
  (executor) =>
    ((executor.attestation as unknown as Record<string, unknown>)[
      "exactResultIdentityVersionResponse"
    ] = false),
);
executorDenied(
  (executor) =>
    ((executor.attestation as unknown as Record<string, unknown>)[
      "visualDigestInvariant"
    ] = false),
);
executorDenied(
  (executor) =>
    ((executor.attestation as unknown as Record<string, unknown>)[
      "fallbackMatchingAllowed"
    ] = true),
);
executorDenied(
  (executor) =>
    ((executor.attestation as unknown as Record<string, unknown>)[
      "autoConflictResolutionAllowed"
    ] = true),
);

console.log(
  JSON.stringify({
    result: "PASS",
    acceptedContracts,
    enabledContracts,
    adversarialDenials,
    io: {
      database: false,
      network: false,
      provider: false,
      customer: false,
    },
  }),
);
