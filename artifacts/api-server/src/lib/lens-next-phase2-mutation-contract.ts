export const LENS_NEXT_PHASE2_MUTATION_CONTRACT_VERSION =
  "bimlog-lens-next-phase2-mutation-v1" as const;

export const LENS_NEXT_PHASE2_ACTIONS = [
  "status",
  "comment",
  "assignment",
] as const;
export type LensNextPhase2Action = (typeof LENS_NEXT_PHASE2_ACTIONS)[number];

export const LENS_NEXT_LIFECYCLE_STATES = [
  "active",
  "superseded",
  "voided",
] as const;
export type LensNextLifecycleState =
  (typeof LENS_NEXT_LIFECYCLE_STATES)[number];

export const LENS_NEXT_ACTION_FEATURE_FLAGS: Record<
  LensNextPhase2Action,
  string
> = {
  status: "lens_next.status_updates",
  comment: "lens_next.comments",
  assignment: "lens_next.platform_metadata_writes",
};

export const LENS_NEXT_ACTION_NATIVE_COMMANDS: Record<
  LensNextPhase2Action,
  string
> = {
  status: "phase2-update-status",
  comment: "phase2-add-comment",
  assignment: "phase2-update-assignment",
};

export type LensNextMutationDenialCode =
  | "contract_invalid"
  | "identity_invalid"
  | "precondition_invalid"
  | "permission_evidence_invalid"
  | "pilot_policy_invalid"
  | "idempotency_invalid"
  | "payload_invalid"
  | "visual_state_forbidden"
  | "fallback_forbidden";

export interface LensNextPhase2MutationRequest {
  contractVersion: typeof LENS_NEXT_PHASE2_MUTATION_CONTRACT_VERSION;
  action: LensNextPhase2Action;
  projectId: number;
  serverId: number;
  viewpointId: string;
  issueFamilyId: string;
  lifecycleStatus: LensNextLifecycleState;
  revisionNumber: number;
  actorId: string;
  idempotencyId: string;
  precondition: {
    expectedStatus: string;
    expectedVersion: number;
    expectedRevisionNumber: number;
  };
  permissionEvidence: {
    receiptId: string;
    receiptSha256: string;
    subjectId: string;
    action: LensNextPhase2Action;
    projectId: number;
    serverId: number;
    current: true;
    expiresAt: string;
  };
  pilotPolicy: {
    receiptId: string;
    receiptSha256: string;
    environment: "sandbox" | "pilot";
    projectId: number;
    pilotUserId: string;
    featureFlag: string;
    enabled: true;
    productionWriteAllowed: false;
    expiresAt: string;
  };
  payload:
    | { nextStatus: string }
    | { body: string }
    | { assigneeUserId: string; responsibleCompanyId: string };
}

export interface LensNextHeldMutationPlan {
  status: "HELD_CONTRACT_ONLY";
  mutationAllowed: false;
  authorityGranted: false;
  action: LensNextPhase2Action;
  identity: {
    projectId: number;
    serverId: number;
    viewpointId: string;
    issueFamilyId: string;
    lifecycleStatus: LensNextLifecycleState;
    revisionNumber: number;
  };
  executionRequirements: {
    authenticatedWritePermission: true;
    atomicExpectedVersionAndStatusPredicate: true;
    zeroUpdatedRowsReturn409: true;
    mutationAuditAndIdempotencyReceiptSingleTransaction: true;
    exactResultingIdentityAndVersionResponse: true;
    visualStateDigestMustRemainUnchanged: true;
    fallbackResolutionForbidden: true;
    automaticConflictResolutionForbidden: true;
  };
}

export type LensNextMutationValidation =
  | { ok: true; plan: LensNextHeldMutationPlan }
  | { ok: false; code: LensNextMutationDenialCode; message: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const RECEIPT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const VIEWPOINT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/;
const STATUS = /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonEmptyBounded(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maximum
  );
}

function currentExpiry(value: unknown, nowMs: number): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    Date.parse(value) > nowMs
  );
}

function deny(
  code: LensNextMutationDenialCode,
  message: string,
): LensNextMutationValidation {
  return { ok: false, code, message };
}

function validatePayload(
  action: LensNextPhase2Action,
  payload: unknown,
): boolean {
  if (!isRecord(payload)) return false;
  if (action === "status") {
    return (
      hasExactKeys(payload, ["nextStatus"]) &&
      typeof payload.nextStatus === "string" &&
      STATUS.test(payload.nextStatus)
    );
  }
  if (action === "comment") {
    return (
      hasExactKeys(payload, ["body"]) && nonEmptyBounded(payload.body, 4000)
    );
  }
  return (
    hasExactKeys(payload, ["assigneeUserId", "responsibleCompanyId"]) &&
    typeof payload.assigneeUserId === "string" &&
    UUID.test(payload.assigneeUserId) &&
    typeof payload.responsibleCompanyId === "string" &&
    UUID.test(payload.responsibleCompanyId)
  );
}

export function validateLensNextPhase2Mutation(
  input: unknown,
  options: { nowMs: number },
): LensNextMutationValidation {
  if (!isRecord(input))
    return deny("contract_invalid", "request must be an object");
  const rootKeys = [
    "contractVersion",
    "action",
    "projectId",
    "serverId",
    "viewpointId",
    "issueFamilyId",
    "lifecycleStatus",
    "revisionNumber",
    "actorId",
    "idempotencyId",
    "precondition",
    "permissionEvidence",
    "pilotPolicy",
    "payload",
  ] as const;
  if (!hasExactKeys(input, rootKeys)) {
    const forbiddenVisualOrFallback = Object.keys(input).some((key) =>
      /camera|screenshot|selection|visibility|section|override|redline|label|folder|tree|activeview|bestguess|firstmatch/i.test(
        key,
      ),
    );
    return deny(
      forbiddenVisualOrFallback ? "visual_state_forbidden" : "contract_invalid",
      "unknown, visual-state, authority, or fallback fields are forbidden",
    );
  }
  if (
    input.contractVersion !== LENS_NEXT_PHASE2_MUTATION_CONTRACT_VERSION ||
    typeof input.action !== "string" ||
    !LENS_NEXT_PHASE2_ACTIONS.includes(input.action as LensNextPhase2Action)
  ) {
    return deny("contract_invalid", "unsupported contract version or action");
  }
  const action = input.action as LensNextPhase2Action;
  if (
    !positiveInteger(input.projectId) ||
    !positiveInteger(input.serverId) ||
    typeof input.viewpointId !== "string" ||
    !VIEWPOINT_ID.test(input.viewpointId) ||
    typeof input.issueFamilyId !== "string" ||
    !UUID.test(input.issueFamilyId) ||
    typeof input.lifecycleStatus !== "string" ||
    !LENS_NEXT_LIFECYCLE_STATES.includes(
      input.lifecycleStatus as LensNextLifecycleState,
    ) ||
    !positiveInteger(input.revisionNumber)
  ) {
    return deny(
      "identity_invalid",
      "exact immutable identity, lifecycle, and positive revision are required",
    );
  }
  if (typeof input.actorId !== "string" || !UUID.test(input.actorId)) {
    return deny("permission_evidence_invalid", "actor identity is invalid");
  }
  if (
    typeof input.idempotencyId !== "string" ||
    !RECEIPT_ID.test(input.idempotencyId) ||
    !input.idempotencyId.startsWith(
      `${input.actorId}:${action}:${input.projectId}:${input.serverId}:${input.revisionNumber}:`,
    )
  ) {
    return deny(
      "idempotency_invalid",
      "idempotency identity must bind actor, action, project, server, and revision",
    );
  }
  if (
    !isRecord(input.precondition) ||
    !hasExactKeys(input.precondition, [
      "expectedStatus",
      "expectedVersion",
      "expectedRevisionNumber",
    ]) ||
    typeof input.precondition.expectedStatus !== "string" ||
    !STATUS.test(input.precondition.expectedStatus) ||
    !positiveInteger(input.precondition.expectedVersion) ||
    input.precondition.expectedRevisionNumber !== input.revisionNumber
  ) {
    return deny(
      "precondition_invalid",
      "exact status, version, and revision preconditions are required",
    );
  }
  if (
    !isRecord(input.permissionEvidence) ||
    !hasExactKeys(input.permissionEvidence, [
      "receiptId",
      "receiptSha256",
      "subjectId",
      "action",
      "projectId",
      "serverId",
      "current",
      "expiresAt",
    ]) ||
    typeof input.permissionEvidence.receiptId !== "string" ||
    !RECEIPT_ID.test(input.permissionEvidence.receiptId) ||
    typeof input.permissionEvidence.receiptSha256 !== "string" ||
    !SHA256.test(input.permissionEvidence.receiptSha256) ||
    input.permissionEvidence.subjectId !== input.actorId ||
    input.permissionEvidence.action !== action ||
    input.permissionEvidence.projectId !== input.projectId ||
    input.permissionEvidence.serverId !== input.serverId ||
    input.permissionEvidence.current !== true ||
    !currentExpiry(input.permissionEvidence.expiresAt, options.nowMs)
  ) {
    return deny(
      "permission_evidence_invalid",
      "current evidence-bound write capability is required",
    );
  }
  if (
    !isRecord(input.pilotPolicy) ||
    !hasExactKeys(input.pilotPolicy, [
      "receiptId",
      "receiptSha256",
      "environment",
      "projectId",
      "pilotUserId",
      "featureFlag",
      "enabled",
      "productionWriteAllowed",
      "expiresAt",
    ]) ||
    typeof input.pilotPolicy.receiptId !== "string" ||
    !RECEIPT_ID.test(input.pilotPolicy.receiptId) ||
    typeof input.pilotPolicy.receiptSha256 !== "string" ||
    !SHA256.test(input.pilotPolicy.receiptSha256) ||
    !["sandbox", "pilot"].includes(String(input.pilotPolicy.environment)) ||
    input.pilotPolicy.projectId !== input.projectId ||
    input.pilotPolicy.pilotUserId !== input.actorId ||
    input.pilotPolicy.featureFlag !== LENS_NEXT_ACTION_FEATURE_FLAGS[action] ||
    input.pilotPolicy.enabled !== true ||
    input.pilotPolicy.productionWriteAllowed !== false ||
    !currentExpiry(input.pilotPolicy.expiresAt, options.nowMs)
  ) {
    return deny(
      "pilot_policy_invalid",
      "an evidence-bound action-specific sandbox or pilot policy is required",
    );
  }
  if (!validatePayload(action, input.payload)) {
    return deny(
      "payload_invalid",
      "the action payload is invalid or contains unknown fields",
    );
  }

  const request = input as unknown as LensNextPhase2MutationRequest;
  return {
    ok: true,
    plan: {
      status: "HELD_CONTRACT_ONLY",
      mutationAllowed: false,
      authorityGranted: false,
      action,
      identity: {
        projectId: request.projectId,
        serverId: request.serverId,
        viewpointId: request.viewpointId,
        issueFamilyId: request.issueFamilyId,
        lifecycleStatus: request.lifecycleStatus,
        revisionNumber: request.revisionNumber,
      },
      executionRequirements: {
        authenticatedWritePermission: true,
        atomicExpectedVersionAndStatusPredicate: true,
        zeroUpdatedRowsReturn409: true,
        mutationAuditAndIdempotencyReceiptSingleTransaction: true,
        exactResultingIdentityAndVersionResponse: true,
        visualStateDigestMustRemainUnchanged: true,
        fallbackResolutionForbidden: true,
        automaticConflictResolutionForbidden: true,
      },
    },
  };
}
