export const LENS_NEXT_PHASE2_ACTIONS = [
  "status",
  "comment",
  "assignment",
] as const;

export type LensNextPhase2Action = (typeof LENS_NEXT_PHASE2_ACTIONS)[number];
export const LENS_NEXT_PHASE2_STATUSES = [
  "open",
  "follow_up",
  "waiting_design",
  "approved",
  "resolved",
] as const;
export type LensNextPhase2Status = (typeof LENS_NEXT_PHASE2_STATUSES)[number];

const ACTION_REQUIREMENTS = {
  status: {
    flag: "lens_next.status_updates",
    permission: "lens_next.status.write",
  },
  comment: {
    flag: "lens_next.comments",
    permission: "lens_next.comment.write",
  },
  assignment: {
    flag: "lens_next.platform_metadata_writes",
    permission: "lens_next.assignment.write",
  },
} as const satisfies Record<
  LensNextPhase2Action,
  { flag: string; permission: string }
>;

export interface LensNextPhase2CapabilityInput {
  contractVersion: "lens-next-phase2-capability.v1";
  evaluatedAt: string;
  action: LensNextPhase2Action;
  environment: "sandbox" | "pilot" | "production";
  actionFlag: {
    key: string;
    enabled: boolean;
    receiptId: string;
    version: number;
    current: boolean;
  };
  policy: {
    receiptId: string;
    receiptSha256: string;
    version: number;
    environment: "sandbox" | "pilot" | "production";
    projectId: number;
    approvedPilotUserId: number;
    approved: boolean;
    current: boolean;
    productionWriteAllowed: false;
    expiresAt: string;
  };
  session: {
    sessionId: string;
    actorUserId: number;
    projectId: number;
    modelFingerprint: string;
    active: boolean;
  };
  identity: {
    projectId: number;
    serverId: number;
    viewpointId: string;
    issueFamilyId: string;
    lifecycleStatus: "active" | "superseded" | "voided";
    revisionNumber: number;
    modelFingerprint: string;
  };
  preconditions: {
    issueFamilyId: string;
    expectedStatus: LensNextPhase2Status;
    expectedVersion: number;
    expectedRevisionNumber: number;
  };
  permissionEvidence: {
    receiptId: string;
    receiptSha256: string;
    actorUserId: number;
    projectId: number;
    serverId: number;
    capability: string;
    granted: boolean;
    current: boolean;
    expiresAt: string;
  };
  idempotency: {
    id: string;
    actorUserId: number;
    projectId: number;
    serverId: number;
    revisionNumber: number;
    action: LensNextPhase2Action;
  };
  visualState: {
    digestBefore: string;
    digestAfter: string;
  };
  serverExecutor?: {
    action: LensNextPhase2Action;
    endpointContractId: string;
    endpointPath: string;
    receiptId: string;
    receiptSha256: string;
    trustedSource: "server_runtime";
    current: boolean;
    expiresAt: string;
    attestation: {
      atomicExpectedStatusVersionRevisionPredicate: true;
      zeroRowsConflictStatus: 409;
      auditAndIdempotencySameTransaction: true;
      exactResultIdentityVersionResponse: true;
      visualDigestInvariant: true;
      fallbackMatchingAllowed: false;
      autoConflictResolutionAllowed: false;
      projectId: number;
      serverId: number;
      viewpointId: string;
      issueFamilyId: string;
      expectedStatus: LensNextPhase2Status;
      expectedVersion: number;
      expectedRevisionNumber: number;
      idempotencyId: string;
      visualStateDigest: string;
    };
  };
}

export interface LensNextPhase2CapabilityDecision {
  action: LensNextPhase2Action | null;
  contractReady: boolean;
  enabled: boolean;
  dispatchAllowed: boolean;
  mutationAllowed: false;
  serverExecutorBound: boolean;
  visualMutationAllowed: false;
  persistentTokenStoreAllowed: false;
  conflictAutoResolutionAllowed: false;
  reasons: string[];
  requiredFlag: string | null;
  requiredPermission: string | null;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const RECEIPT = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$/;
const ENDPOINT = /^\/api\/[A-Za-z0-9/_{}:.-]+$/;

const keys = (value: unknown): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>)
    : [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknown(
  value: unknown,
  allowed: readonly string[],
  path: string,
  reasons: string[],
) {
  if (!isRecord(value)) {
    reasons.push(`${path}:OBJECT_REQUIRED`);
    return;
  }
  for (const key of keys(value)) {
    if (!allowed.includes(key)) reasons.push(`${path}.${key}:FIELD_FORBIDDEN`);
  }
}

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function receipt(value: unknown) {
  return typeof value === "string" && RECEIPT.test(value);
}

function timestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function asAction(value: unknown): LensNextPhase2Action | null {
  return (LENS_NEXT_PHASE2_ACTIONS as readonly unknown[]).includes(value)
    ? (value as LensNextPhase2Action)
    : null;
}

/**
 * Pure, fail-closed Lens Next Phase-2 capability evaluation.
 *
 * This function performs no mutation or I/O. A client-ready envelope is not a
 * write authorization: mutation remains disabled until a current server-runtime
 * executor receipt and endpoint contract are bound to the same action.
 */
export function evaluateLensNextPhase2Capability(
  raw: unknown,
): LensNextPhase2CapabilityDecision {
  const reasons: string[] = [];
  const input = isRecord(raw) ? raw : {};
  rejectUnknown(
    raw,
    [
      "contractVersion",
      "evaluatedAt",
      "action",
      "environment",
      "actionFlag",
      "policy",
      "session",
      "identity",
      "preconditions",
      "permissionEvidence",
      "idempotency",
      "visualState",
      "serverExecutor",
    ],
    "request",
    reasons,
  );

  const action = asAction(input.action);
  const requirement = action ? ACTION_REQUIREMENTS[action] : null;
  if (input.contractVersion !== "lens-next-phase2-capability.v1")
    reasons.push("CONTRACT_VERSION_UNSUPPORTED");
  if (!timestamp(input.evaluatedAt)) reasons.push("EVALUATION_TIME_INVALID");
  if (!action) reasons.push("ACTION_UNSUPPORTED");
  if (input.environment !== "sandbox" && input.environment !== "pilot")
    reasons.push("PRODUCTION_OR_UNKNOWN_ENVIRONMENT_DENIED");

  const flag = isRecord(input.actionFlag) ? input.actionFlag : {};
  rejectUnknown(
    input.actionFlag,
    ["key", "enabled", "receiptId", "version", "current"],
    "actionFlag",
    reasons,
  );
  if (!requirement || flag.key !== requirement.flag)
    reasons.push("ACTION_FLAG_MISMATCH");
  if (flag.enabled !== true || flag.current !== true)
    reasons.push("ACTION_FLAG_NOT_CURRENTLY_ENABLED");
  if (!receipt(flag.receiptId) || !positiveInteger(flag.version))
    reasons.push("ACTION_FLAG_EVIDENCE_INVALID");

  const policy = isRecord(input.policy) ? input.policy : {};
  rejectUnknown(
    input.policy,
    [
      "receiptId",
      "receiptSha256",
      "version",
      "environment",
      "projectId",
      "approvedPilotUserId",
      "approved",
      "current",
      "productionWriteAllowed",
      "expiresAt",
    ],
    "policy",
    reasons,
  );
  if (
    policy.environment !== input.environment ||
    (policy.environment !== "sandbox" && policy.environment !== "pilot")
  )
    reasons.push("POLICY_ENVIRONMENT_MISMATCH");
  if (
    policy.approved !== true ||
    policy.current !== true ||
    !positiveInteger(policy.projectId) ||
    !positiveInteger(policy.approvedPilotUserId) ||
    !positiveInteger(policy.version) ||
    !receipt(policy.receiptId) ||
    typeof policy.receiptSha256 !== "string" ||
    !SHA256.test(policy.receiptSha256) ||
    policy.productionWriteAllowed !== false ||
    !timestamp(policy.expiresAt) ||
    !timestamp(input.evaluatedAt) ||
    Date.parse(String(policy.expiresAt)) <=
      Date.parse(String(input.evaluatedAt))
  )
    reasons.push("SANDBOX_PILOT_POLICY_INVALID");

  const session = isRecord(input.session) ? input.session : {};
  rejectUnknown(
    input.session,
    ["sessionId", "actorUserId", "projectId", "modelFingerprint", "active"],
    "session",
    reasons,
  );
  if (
    session.active !== true ||
    !receipt(session.sessionId) ||
    !positiveInteger(session.actorUserId) ||
    !positiveInteger(session.projectId) ||
    typeof session.modelFingerprint !== "string" ||
    !SHA256.test(session.modelFingerprint)
  )
    reasons.push("ACTIVE_SESSION_CONTEXT_INVALID");

  const identity = isRecord(input.identity) ? input.identity : {};
  rejectUnknown(
    input.identity,
    [
      "projectId",
      "serverId",
      "viewpointId",
      "issueFamilyId",
      "lifecycleStatus",
      "revisionNumber",
      "modelFingerprint",
    ],
    "identity",
    reasons,
  );
  if (
    !positiveInteger(identity.projectId) ||
    !positiveInteger(identity.serverId) ||
    typeof identity.viewpointId !== "string" ||
    !UUID.test(identity.viewpointId) ||
    typeof identity.issueFamilyId !== "string" ||
    !UUID.test(identity.issueFamilyId) ||
    identity.lifecycleStatus !== "active" ||
    !positiveInteger(identity.revisionNumber) ||
    typeof identity.modelFingerprint !== "string" ||
    !SHA256.test(identity.modelFingerprint)
  )
    reasons.push("IMMUTABLE_ACTIVE_IDENTITY_INVALID");

  const preconditions = isRecord(input.preconditions)
    ? input.preconditions
    : {};
  rejectUnknown(
    input.preconditions,
    [
      "issueFamilyId",
      "expectedStatus",
      "expectedVersion",
      "expectedRevisionNumber",
    ],
    "preconditions",
    reasons,
  );
  if (
    preconditions.issueFamilyId !== identity.issueFamilyId ||
    !(LENS_NEXT_PHASE2_STATUSES as readonly unknown[]).includes(
      preconditions.expectedStatus,
    ) ||
    !positiveInteger(preconditions.expectedVersion) ||
    preconditions.expectedRevisionNumber !== identity.revisionNumber
  )
    reasons.push("EXPECTED_STATE_PRECONDITIONS_INVALID");

  if (
    session.projectId !== identity.projectId ||
    session.projectId !== policy.projectId ||
    session.actorUserId !== policy.approvedPilotUserId ||
    session.modelFingerprint !== identity.modelFingerprint
  )
    reasons.push("SESSION_POLICY_IDENTITY_BINDING_MISMATCH");

  const permission = isRecord(input.permissionEvidence)
    ? input.permissionEvidence
    : {};
  rejectUnknown(
    input.permissionEvidence,
    [
      "receiptId",
      "receiptSha256",
      "actorUserId",
      "projectId",
      "serverId",
      "capability",
      "granted",
      "current",
      "expiresAt",
    ],
    "permissionEvidence",
    reasons,
  );
  if (
    !requirement ||
    permission.capability !== requirement.permission ||
    permission.granted !== true ||
    permission.current !== true ||
    permission.actorUserId !== session.actorUserId ||
    permission.projectId !== session.projectId ||
    permission.serverId !== identity.serverId ||
    !receipt(permission.receiptId) ||
    typeof permission.receiptSha256 !== "string" ||
    !SHA256.test(permission.receiptSha256) ||
    !timestamp(permission.expiresAt) ||
    !timestamp(input.evaluatedAt) ||
    Date.parse(String(permission.expiresAt)) <=
      Date.parse(String(input.evaluatedAt))
  )
    reasons.push("CURRENT_SERVER_PERMISSION_EVIDENCE_INVALID");

  const idempotency = isRecord(input.idempotency) ? input.idempotency : {};
  rejectUnknown(
    input.idempotency,
    ["id", "actorUserId", "projectId", "serverId", "revisionNumber", "action"],
    "idempotency",
    reasons,
  );
  if (
    typeof idempotency.id !== "string" ||
    !IDEMPOTENCY.test(idempotency.id) ||
    idempotency.actorUserId !== session.actorUserId ||
    idempotency.projectId !== session.projectId ||
    idempotency.serverId !== identity.serverId ||
    idempotency.revisionNumber !== identity.revisionNumber ||
    idempotency.action !== action
  )
    reasons.push("ACTOR_SCOPED_IDEMPOTENCY_INVALID");

  const visual = isRecord(input.visualState) ? input.visualState : {};
  rejectUnknown(
    input.visualState,
    ["digestBefore", "digestAfter"],
    "visualState",
    reasons,
  );
  if (
    typeof visual.digestBefore !== "string" ||
    typeof visual.digestAfter !== "string" ||
    !SHA256.test(visual.digestBefore) ||
    visual.digestBefore !== visual.digestAfter
  )
    reasons.push("VISUAL_STATE_CHANGED_OR_UNBOUND");

  const executor = isRecord(input.serverExecutor) ? input.serverExecutor : null;
  if (input.serverExecutor !== undefined)
    rejectUnknown(
      input.serverExecutor,
      [
        "action",
        "endpointContractId",
        "endpointPath",
        "receiptId",
        "receiptSha256",
        "trustedSource",
        "current",
        "expiresAt",
        "attestation",
      ],
      "serverExecutor",
      reasons,
    );
  const attestation =
    executor && isRecord(executor.attestation) ? executor.attestation : null;
  if (executor)
    rejectUnknown(
      executor.attestation,
      [
        "atomicExpectedStatusVersionRevisionPredicate",
        "zeroRowsConflictStatus",
        "auditAndIdempotencySameTransaction",
        "exactResultIdentityVersionResponse",
        "visualDigestInvariant",
        "fallbackMatchingAllowed",
        "autoConflictResolutionAllowed",
        "projectId",
        "serverId",
        "viewpointId",
        "issueFamilyId",
        "expectedStatus",
        "expectedVersion",
        "expectedRevisionNumber",
        "idempotencyId",
        "visualStateDigest",
      ],
      "serverExecutor.attestation",
      reasons,
    );
  const serverExecutorBound = Boolean(
    executor &&
    executor.action === action &&
    receipt(executor.endpointContractId) &&
    typeof executor.endpointPath === "string" &&
    ENDPOINT.test(executor.endpointPath) &&
    receipt(executor.receiptId) &&
    typeof executor.receiptSha256 === "string" &&
    SHA256.test(executor.receiptSha256) &&
    executor.trustedSource === "server_runtime" &&
    executor.current === true &&
    timestamp(executor.expiresAt) &&
    timestamp(input.evaluatedAt) &&
    Date.parse(String(executor.expiresAt)) >
      Date.parse(String(input.evaluatedAt)) &&
    attestation?.atomicExpectedStatusVersionRevisionPredicate === true &&
    attestation.zeroRowsConflictStatus === 409 &&
    attestation.auditAndIdempotencySameTransaction === true &&
    attestation.exactResultIdentityVersionResponse === true &&
    attestation.visualDigestInvariant === true &&
    attestation.fallbackMatchingAllowed === false &&
    attestation.autoConflictResolutionAllowed === false &&
    attestation.projectId === identity.projectId &&
    attestation.serverId === identity.serverId &&
    attestation.viewpointId === identity.viewpointId &&
    attestation.issueFamilyId === identity.issueFamilyId &&
    attestation.expectedStatus === preconditions.expectedStatus &&
    attestation.expectedVersion === preconditions.expectedVersion &&
    attestation.expectedRevisionNumber ===
      preconditions.expectedRevisionNumber &&
    attestation.idempotencyId === idempotency.id &&
    attestation.visualStateDigest === visual.digestBefore,
  );
  if (executor && !serverExecutorBound)
    reasons.push("SERVER_EXECUTOR_BINDING_INVALID");

  const clientReasons = reasons.filter(
    (reason) => reason !== "SERVER_EXECUTOR_BINDING_INVALID",
  );
  const contractReady = clientReasons.length === 0;
  if (contractReady && !serverExecutorBound)
    reasons.push("SERVER_EXECUTOR_NOT_BOUND");
  const dispatchAllowed =
    contractReady && serverExecutorBound && reasons.length === 0;

  return {
    action,
    contractReady,
    enabled: dispatchAllowed,
    dispatchAllowed,
    mutationAllowed: false,
    serverExecutorBound,
    visualMutationAllowed: false,
    persistentTokenStoreAllowed: false,
    conflictAutoResolutionAllowed: false,
    reasons: [...new Set(reasons)].sort(),
    requiredFlag: requirement?.flag ?? null,
    requiredPermission: requirement?.permission ?? null,
  };
}
