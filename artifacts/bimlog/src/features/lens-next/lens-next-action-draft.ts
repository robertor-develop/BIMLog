import type {
  LensNextPhase2Action,
  LensNextPhase2CapabilityDecision,
} from "./lens-next-phase2-capability";

export const LENS_NEXT_ACTION_DRAFT_VERSION =
  "lens-next-action-draft.v1" as const;
export const LENS_NEXT_DRAFT_STATUSES = [
  "open",
  "follow_up",
  "waiting_design",
  "approved",
  "resolved",
] as const;
export type LensNextDraftStatus = (typeof LENS_NEXT_DRAFT_STATUSES)[number];

export interface LensNextActionDraftInput {
  contractVersion: typeof LENS_NEXT_ACTION_DRAFT_VERSION;
  action: LensNextPhase2Action;
  actorId: string;
  nonce: string;
  identity: {
    projectId: number;
    issueFamilyId: string;
    serverId: number;
    viewpointId: string;
    lifecycleStatus: "active" | "superseded" | "voided";
    revisionNumber: number;
  };
  preconditions: {
    issueFamilyId: string;
    expectedStatus: LensNextDraftStatus;
    expectedVersion: number;
    expectedRevisionNumber: number;
  };
  payload:
    | { nextStatus: LensNextDraftStatus }
    | { body: string }
    | { assigneeUserId: string; responsibleCompanyId: string };
  confirmation: {
    confirmed: boolean;
    reason: string | null;
  };
  capability: Pick<
    LensNextPhase2CapabilityDecision,
    | "action"
    | "contractReady"
    | "enabled"
    | "dispatchAllowed"
    | "mutationAllowed"
    | "serverExecutorBound"
    | "visualMutationAllowed"
    | "persistentTokenStoreAllowed"
    | "conflictAutoResolutionAllowed"
  >;
  visualState: {
    digestBefore: string;
    digestAfter: string;
  };
}

export interface LensNextDraftMessage {
  code: string;
  en: string;
  es: string;
}

export type LensNextActionDraftDecision =
  | {
      ok: true;
      status: "REQUEST_DRAFT_ONLY";
      dispatchPerformed: false;
      productionWriteAllowed: false;
      authorityGranted: false;
      mutationAllowed: false;
      draft: {
        contractVersion: "lens-next-phase2-mutation-draft.v1";
        action: LensNextPhase2Action;
        actorId: string;
        idempotencyId: string;
        identity: LensNextActionDraftInput["identity"];
        preconditions: LensNextActionDraftInput["preconditions"];
        payload: LensNextActionDraftInput["payload"];
        confirmationReason: string | null;
        visualStateDigest: string;
      };
    }
  | {
      ok: false;
      status: "ACTION_BLOCKED";
      dispatchPerformed: false;
      productionWriteAllowed: false;
      authorityGranted: false;
      mutationAllowed: false;
      errors: LensNextDraftMessage[];
    };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const VIEWPOINT = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/;
const NONCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

const MESSAGES: Record<string, LensNextDraftMessage> = {
  CONTRACT_INVALID: {
    code: "CONTRACT_INVALID",
    en: "The action draft contains unsupported or unknown fields.",
    es: "El borrador de la acción contiene campos desconocidos o no compatibles.",
  },
  IDENTITY_INVALID: {
    code: "IDENTITY_INVALID",
    en: "A unique active immutable issue identity is required.",
    es: "Se requiere una identidad inmutable, única y activa del asunto.",
  },
  PRECONDITION_STALE: {
    code: "PRECONDITION_STALE",
    en: "The expected issue status, version, or revision is stale or ambiguous.",
    es: "El estado, la versión o la revisión esperada está desactualizada o es ambigua.",
  },
  PAYLOAD_INVALID: {
    code: "PAYLOAD_INVALID",
    en: "The action payload is invalid or exceeds its allowed bounds.",
    es: "La carga de la acción no es válida o supera los límites permitidos.",
  },
  CONFIRMATION_REQUIRED: {
    code: "CONFIRMATION_REQUIRED",
    en: "Explicit user confirmation is required.",
    es: "Se requiere la confirmación explícita del usuario.",
  },
  REASON_REQUIRED: {
    code: "REASON_REQUIRED",
    en: "A bounded reason is required for this action.",
    es: "Se requiere un motivo dentro de los límites para esta acción.",
  },
  CAPABILITY_NOT_DISPATCHABLE: {
    code: "CAPABILITY_NOT_DISPATCHABLE",
    en: "The current capability decision does not permit request dispatch.",
    es: "La decisión de capacidad actual no permite enviar la solicitud.",
  },
  VISUAL_STATE_CHANGED: {
    code: "VISUAL_STATE_CHANGED",
    en: "Visual state changed while the action was being drafted.",
    es: "El estado visual cambió mientras se preparaba la acción.",
  },
  IDEMPOTENCY_INVALID: {
    code: "IDEMPOTENCY_INVALID",
    en: "A valid actor-scoped nonce is required.",
    es: "Se requiere un nonce válido limitado al actor.",
  },
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]) {
  if (!record(value)) return false;
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index])
  );
}

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function bounded(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length >= minimum &&
    value.length <= maximum
  );
}

function validPayload(action: LensNextPhase2Action, payload: unknown) {
  if (action === "status")
    return (
      exactKeys(payload, ["nextStatus"]) &&
      (LENS_NEXT_DRAFT_STATUSES as readonly unknown[]).includes(
        (payload as Record<string, unknown>).nextStatus,
      )
    );
  if (action === "comment")
    return (
      exactKeys(payload, ["body"]) &&
      bounded((payload as Record<string, unknown>).body, 1, 4000)
    );
  return (
    exactKeys(payload, ["assigneeUserId", "responsibleCompanyId"]) &&
    UUID.test(String((payload as Record<string, unknown>).assigneeUserId)) &&
    UUID.test(String((payload as Record<string, unknown>).responsibleCompanyId))
  );
}

function block(codes: string[]): LensNextActionDraftDecision {
  return {
    ok: false,
    status: "ACTION_BLOCKED",
    dispatchPerformed: false,
    productionWriteAllowed: false,
    authorityGranted: false,
    mutationAllowed: false,
    errors: [...new Set(codes)].sort().map((code) => MESSAGES[code]),
  };
}

export function createLensNextActionDraft(
  raw: unknown,
): LensNextActionDraftDecision {
  if (
    !exactKeys(raw, [
      "contractVersion",
      "action",
      "actorId",
      "nonce",
      "identity",
      "preconditions",
      "payload",
      "confirmation",
      "capability",
      "visualState",
    ])
  )
    return block(["CONTRACT_INVALID"]);
  const input = raw as LensNextActionDraftInput;
  const errors: string[] = [];
  if (
    input.contractVersion !== LENS_NEXT_ACTION_DRAFT_VERSION ||
    !["status", "comment", "assignment"].includes(input.action)
  )
    errors.push("CONTRACT_INVALID");
  if (
    !exactKeys(input.identity, [
      "projectId",
      "issueFamilyId",
      "serverId",
      "viewpointId",
      "lifecycleStatus",
      "revisionNumber",
    ]) ||
    !positiveInteger(input.identity.projectId) ||
    !UUID.test(input.identity.issueFamilyId) ||
    !positiveInteger(input.identity.serverId) ||
    !VIEWPOINT.test(input.identity.viewpointId) ||
    input.identity.lifecycleStatus !== "active" ||
    !positiveInteger(input.identity.revisionNumber)
  )
    errors.push("IDENTITY_INVALID");
  if (
    !exactKeys(input.preconditions, [
      "issueFamilyId",
      "expectedStatus",
      "expectedVersion",
      "expectedRevisionNumber",
    ]) ||
    input.preconditions.issueFamilyId !== input.identity.issueFamilyId ||
    !(LENS_NEXT_DRAFT_STATUSES as readonly unknown[]).includes(
      input.preconditions.expectedStatus,
    ) ||
    !positiveInteger(input.preconditions.expectedVersion) ||
    input.preconditions.expectedRevisionNumber !== input.identity.revisionNumber
  )
    errors.push("PRECONDITION_STALE");
  if (!validPayload(input.action, input.payload))
    errors.push("PAYLOAD_INVALID");
  if (
    !exactKeys(input.confirmation, ["confirmed", "reason"]) ||
    input.confirmation.confirmed !== true
  )
    errors.push("CONFIRMATION_REQUIRED");
  const reasonRequired =
    input.action === "status" || input.action === "assignment";
  if (reasonRequired && !bounded(input.confirmation.reason, 3, 500))
    errors.push("REASON_REQUIRED");
  if (
    !exactKeys(input.capability, [
      "action",
      "contractReady",
      "enabled",
      "dispatchAllowed",
      "mutationAllowed",
      "serverExecutorBound",
      "visualMutationAllowed",
      "persistentTokenStoreAllowed",
      "conflictAutoResolutionAllowed",
    ]) ||
    input.capability.action !== input.action ||
    input.capability.contractReady !== true ||
    input.capability.enabled !== true ||
    input.capability.dispatchAllowed !== true ||
    input.capability.mutationAllowed !== false ||
    input.capability.serverExecutorBound !== true ||
    input.capability.visualMutationAllowed !== false ||
    input.capability.persistentTokenStoreAllowed !== false ||
    input.capability.conflictAutoResolutionAllowed !== false
  )
    errors.push("CAPABILITY_NOT_DISPATCHABLE");
  if (
    !exactKeys(input.visualState, ["digestBefore", "digestAfter"]) ||
    !SHA256.test(input.visualState.digestBefore) ||
    input.visualState.digestBefore !== input.visualState.digestAfter
  )
    errors.push("VISUAL_STATE_CHANGED");
  if (!UUID.test(input.actorId) || !NONCE.test(input.nonce))
    errors.push("IDEMPOTENCY_INVALID");
  if (errors.length) return block(errors);

  return {
    ok: true,
    status: "REQUEST_DRAFT_ONLY",
    dispatchPerformed: false,
    productionWriteAllowed: false,
    authorityGranted: false,
    mutationAllowed: false,
    draft: {
      contractVersion: "lens-next-phase2-mutation-draft.v1",
      action: input.action,
      actorId: input.actorId,
      idempotencyId: `${input.actorId}:${input.action}:${input.identity.projectId}:${input.identity.serverId}:${input.identity.revisionNumber}:${input.nonce}`,
      identity: { ...input.identity },
      preconditions: { ...input.preconditions },
      payload: { ...input.payload } as LensNextActionDraftInput["payload"],
      confirmationReason: input.confirmation.reason,
      visualStateDigest: input.visualState.digestBefore,
    },
  };
}
