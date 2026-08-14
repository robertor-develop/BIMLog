import assert from "node:assert/strict";
import {
  createLensNextActionDraft,
  type LensNextActionDraftInput,
} from "../../src/features/lens-next/lens-next-action-draft";
import type { LensNextPhase2Action } from "../../src/features/lens-next/lens-next-phase2-capability";

const actorId = "123e4567-e89b-42d3-a456-426614174000";
const issueFamilyId = "223e4567-e89b-42d3-a456-426614174000";
const digest = "a".repeat(64);

function valid(action: LensNextPhase2Action, nonce = "nonce:injected:0001") {
  const payload =
    action === "status"
      ? { nextStatus: "resolved" as const }
      : action === "comment"
        ? { body: "Coordination review complete." }
        : {
            assigneeUserId: "323e4567-e89b-42d3-a456-426614174000",
            responsibleCompanyId: "423e4567-e89b-42d3-a456-426614174000",
          };
  return {
    contractVersion: "lens-next-action-draft.v1",
    action,
    actorId,
    nonce,
    identity: {
      projectId: 26,
      issueFamilyId,
      serverId: 101,
      viewpointId: "vp-immutable-001",
      lifecycleStatus: "active",
      revisionNumber: 4,
    },
    preconditions: {
      issueFamilyId,
      expectedStatus: "open",
      expectedVersion: 7,
      expectedRevisionNumber: 4,
    },
    payload,
    confirmation: {
      confirmed: true,
      reason: action === "comment" ? null : "Confirmed coordination action.",
    },
    capability: {
      action,
      contractReady: true,
      enabled: true,
      dispatchAllowed: true,
      mutationAllowed: false,
      serverExecutorBound: true,
      visualMutationAllowed: false,
      persistentTokenStoreAllowed: false,
      conflictAutoResolutionAllowed: false,
    },
    visualState: { digestBefore: digest, digestAfter: digest },
  } satisfies LensNextActionDraftInput;
}

let accepted = 0;
for (const action of ["status", "comment", "assignment"] as const) {
  const result = createLensNextActionDraft(valid(action));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected draft");
  assert.equal(result.status, "REQUEST_DRAFT_ONLY");
  assert.equal(result.dispatchPerformed, false);
  assert.equal(result.productionWriteAllowed, false);
  assert.equal(result.authorityGranted, false);
  assert.equal(result.mutationAllowed, false);
  assert.match(
    result.draft.idempotencyId,
    new RegExp(`^${actorId}:${action}:26:101:4:`),
  );
  assert.equal(result.draft.visualStateDigest, digest);
  accepted += 1;
}

const ids = new Set<string>();
for (let index = 0; index < 500; index += 1) {
  const result = createLensNextActionDraft(
    valid("comment", `nonce:injected:${String(index).padStart(4, "0")}`),
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected bounded draft");
  ids.add(result.draft.idempotencyId);
}
assert.equal(ids.size, 500);

let adversarialDenials = 0;
function denied(
  mutate: (input: LensNextActionDraftInput & Record<string, unknown>) => void,
  code: string,
) {
  const input = structuredClone(valid("status")) as LensNextActionDraftInput &
    Record<string, unknown>;
  mutate(input);
  const result = createLensNextActionDraft(input);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected denial");
  assert.ok(result.errors.some((error) => error.code === code));
  assert.ok(result.errors.every((error) => error.en && error.es));
  assert.equal(result.dispatchPerformed, false);
  assert.equal(result.productionWriteAllowed, false);
  assert.equal(result.mutationAllowed, false);
  adversarialDenials += 1;
}

denied((input) => (input.label = "Open"), "CONTRACT_INVALID");
denied((input) => (input.folderPath = "Open/Floor 1"), "CONTRACT_INVALID");
denied((input) => (input.treePosition = 1), "CONTRACT_INVALID");
denied((input) => (input.activeViewpoint = true), "CONTRACT_INVALID");
denied((input) => (input.authorityGranted = true), "CONTRACT_INVALID");
denied((input) => (input.persistentStore = "localStorage"), "CONTRACT_INVALID");
denied((input) => (input.camera = {}), "CONTRACT_INVALID");
denied(
  (input) => (input.identity.lifecycleStatus = "superseded"),
  "IDENTITY_INVALID",
);
denied(
  (input) => (input.identity.issueFamilyId = "ambiguous"),
  "IDENTITY_INVALID",
);
denied(
  (input) => (input.preconditions.expectedVersion = 0),
  "PRECONDITION_STALE",
);
denied(
  (input) => (input.preconditions.expectedRevisionNumber = 3),
  "PRECONDITION_STALE",
);
denied(
  (input) => (input.preconditions.issueFamilyId = actorId),
  "PRECONDITION_STALE",
);
denied(
  (input) => (input.confirmation.confirmed = false),
  "CONFIRMATION_REQUIRED",
);
denied((input) => (input.confirmation.reason = null), "REASON_REQUIRED");
denied(
  (input) => (input.capability.dispatchAllowed = false),
  "CAPABILITY_NOT_DISPATCHABLE",
);
denied(
  (input) =>
    ((input.capability as unknown as Record<string, unknown>)[
      "mutationAllowed"
    ] = true),
  "CAPABILITY_NOT_DISPATCHABLE",
);
denied(
  (input) => (input.capability.serverExecutorBound = false),
  "CAPABILITY_NOT_DISPATCHABLE",
);
denied(
  (input) => (input.visualState.digestAfter = "b".repeat(64)),
  "VISUAL_STATE_CHANGED",
);
denied((input) => (input.nonce = "random"), "IDEMPOTENCY_INVALID");
denied(
  (input) =>
    (input.payload = { nextStatus: "resolved", body: "unknown" } as never),
  "PAYLOAD_INVALID",
);

console.log(
  JSON.stringify({
    result: "PASS",
    accepted,
    draftBatch: ids.size,
    adversarialDenials,
    deterministicNonceInjection: true,
    dispatchPerformed: false,
    productionWriteAllowed: false,
    mutationAllowed: false,
    io: { network: false, database: false, customer: false, provider: false },
  }),
);
