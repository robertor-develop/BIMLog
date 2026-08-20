import type { LensNextActionDraftDecision } from "./lens-next-action-draft";

type RequestDraft = Extract<LensNextActionDraftDecision, { ok: true }>["draft"];

export type LensNextQueueConnectivity = "offline" | "online";
export type LensNextQueueMode = "idle" | "queued" | "blocked";

export interface LensNextExecutorReceiptBinding {
  receiptId: string;
  receiptSha256: string;
  action: RequestDraft["action"];
  actorId: string;
  projectId: number;
  serverId: number;
  revisionNumber: number;
  current: true;
  expiresAt: string;
}

export interface LensNextOfflineQueueItem {
  draft: RequestDraft;
  executorBinding: LensNextExecutorReceiptBinding;
  queuedAtMs: number;
  attempts: number;
  nextRetryAtMs: number | null;
  reconfirmedAtMs: number | null;
  reconfirmationNonce: string | null;
  fingerprint: string;
  byteLength: number;
}

export interface LensNextOfflineQueueState {
  mode: LensNextQueueMode;
  connectivity: LensNextQueueConnectivity;
  items: readonly LensNextOfflineQueueItem[];
  totalBytes: number;
  reason: string | null;
  persistentStorageAllowed: false;
  dispatchPerformed: false;
}

export type LensNextQueueChange =
  | { ok: true; state: LensNextOfflineQueueState; duplicate: boolean }
  | {
      ok: false;
      state: LensNextOfflineQueueState;
      code:
        | "QUEUE_INPUT_INVALID"
        | "QUEUE_DUPLICATE_MISMATCH"
        | "QUEUE_CAPACITY_EXCEEDED"
        | "DRAFT_STALE"
        | "EXECUTOR_RECEIPT_STALE"
        | "RECONFIRMATION_REQUIRED"
        | "RETRY_LIMIT_REACHED";
    };

const SHA256 = /^[0-9a-f]{64}$/i;
const RECEIPT = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const NONCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,159}$/;
const MAX_ITEMS = 100;
const MAX_TOTAL_BYTES = 512_000;
const MAX_ITEM_BYTES = 16_384;
const MAX_ATTEMPTS = 4;
const MAX_BACKOFF_MS = 8_000;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]) {
  if (!record(value)) return false;
  const wanted = [...expected].sort();
  const actual = Object.keys(value).sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  // Deterministic non-cryptographic fingerprint for same-process queue dedupe only.
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(stable(value))) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function blocked(
  state: LensNextOfflineQueueState,
  code: Extract<LensNextQueueChange, { ok: false }>["code"],
): Extract<LensNextQueueChange, { ok: false }> {
  return {
    ok: false,
    code,
    state: {
      ...state,
      mode: "blocked",
      reason: code,
      dispatchPerformed: false,
    },
  };
}

function scope(draft: RequestDraft) {
  return [
    draft.actorId,
    draft.action,
    draft.identity.projectId,
    draft.identity.serverId,
    draft.identity.revisionNumber,
    draft.idempotencyId,
  ].join(":");
}

function validDraft(draft: RequestDraft) {
  return (
    draft.contractVersion === "lens-next-phase2-mutation-draft.v1" &&
    draft.identity.lifecycleStatus === "active" &&
    draft.preconditions.issueFamilyId === draft.identity.issueFamilyId &&
    draft.preconditions.expectedRevisionNumber ===
      draft.identity.revisionNumber &&
    Number.isSafeInteger(draft.preconditions.expectedVersion) &&
    draft.preconditions.expectedVersion > 0 &&
    draft.idempotencyId.startsWith(
      `${draft.actorId}:${draft.action}:${draft.identity.projectId}:${draft.identity.serverId}:${draft.identity.revisionNumber}:`,
    ) &&
    SHA256.test(draft.visualStateDigest)
  );
}

function validExecutor(
  binding: LensNextExecutorReceiptBinding,
  draft: RequestDraft,
  nowMs: number,
) {
  return (
    exactKeys(binding, [
      "receiptId",
      "receiptSha256",
      "action",
      "actorId",
      "projectId",
      "serverId",
      "revisionNumber",
      "current",
      "expiresAt",
    ]) &&
    RECEIPT.test(binding.receiptId) &&
    SHA256.test(binding.receiptSha256) &&
    binding.action === draft.action &&
    binding.actorId === draft.actorId &&
    binding.projectId === draft.identity.projectId &&
    binding.serverId === draft.identity.serverId &&
    binding.revisionNumber === draft.identity.revisionNumber &&
    binding.current === true &&
    Number.isFinite(Date.parse(binding.expiresAt)) &&
    Date.parse(binding.expiresAt) > nowMs
  );
}

export function createLensNextOfflineQueue(
  connectivity: LensNextQueueConnectivity = "offline",
): LensNextOfflineQueueState {
  return {
    mode: "idle",
    connectivity,
    items: [],
    totalBytes: 0,
    reason: null,
    persistentStorageAllowed: false,
    dispatchPerformed: false,
  };
}

export function enqueueLensNextDraft(
  state: LensNextOfflineQueueState,
  raw: unknown,
  nowMs: number,
): LensNextQueueChange {
  if (
    !exactKeys(raw, ["draft", "executorBinding"]) ||
    !record(raw) ||
    !validDraft(raw.draft as RequestDraft)
  )
    return blocked(state, "QUEUE_INPUT_INVALID");
  const draft = raw.draft as RequestDraft;
  const executorBinding = raw.executorBinding as LensNextExecutorReceiptBinding;
  if (!validExecutor(executorBinding, draft, nowMs))
    return blocked(state, "EXECUTOR_RECEIPT_STALE");
  const serialized = stable({ draft, executorBinding });
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  const itemFingerprint = fingerprint({ draft, executorBinding });
  const key = scope(draft);
  const existing = state.items.find((item) => scope(item.draft) === key);
  if (existing) {
    if (existing.fingerprint !== itemFingerprint)
      return blocked(state, "QUEUE_DUPLICATE_MISMATCH");
    return { ok: true, duplicate: true, state };
  }
  if (
    byteLength > MAX_ITEM_BYTES ||
    state.items.length >= MAX_ITEMS ||
    state.totalBytes + byteLength > MAX_TOTAL_BYTES
  )
    return blocked(state, "QUEUE_CAPACITY_EXCEEDED");
  const item: LensNextOfflineQueueItem = {
    draft: structuredClone(draft),
    executorBinding: structuredClone(executorBinding),
    queuedAtMs: nowMs,
    attempts: 0,
    nextRetryAtMs: null,
    reconfirmedAtMs: null,
    reconfirmationNonce: null,
    fingerprint: itemFingerprint,
    byteLength,
  };
  return {
    ok: true,
    duplicate: false,
    state: {
      ...state,
      mode: "queued",
      items: [...state.items, item],
      totalBytes: state.totalBytes + byteLength,
      reason: null,
      dispatchPerformed: false,
    },
  };
}

export function setLensNextQueueConnectivity(
  state: LensNextOfflineQueueState,
  connectivity: LensNextQueueConnectivity,
): LensNextOfflineQueueState {
  return { ...state, connectivity, dispatchPerformed: false };
}

export function reconfirmLensNextQueueHead(
  state: LensNextOfflineQueueState,
  input: {
    nonce: string;
    nowMs: number;
    expectedStatus: string;
    expectedVersion: number;
    expectedRevisionNumber: number;
    executorReceiptSha256: string;
    visualStateDigest: string;
  },
): LensNextQueueChange {
  const head = state.items[0];
  if (!head) return blocked(state, "RECONFIRMATION_REQUIRED");
  if (
    state.connectivity !== "online" ||
    !NONCE.test(input.nonce) ||
    input.expectedStatus !== head.draft.preconditions.expectedStatus ||
    input.expectedVersion !== head.draft.preconditions.expectedVersion ||
    input.expectedRevisionNumber !==
      head.draft.preconditions.expectedRevisionNumber ||
    input.visualStateDigest !== head.draft.visualStateDigest
  )
    return blocked(state, "DRAFT_STALE");
  if (
    input.executorReceiptSha256 !== head.executorBinding.receiptSha256 ||
    Date.parse(head.executorBinding.expiresAt) <= input.nowMs
  )
    return blocked(state, "EXECUTOR_RECEIPT_STALE");
  const items = [...state.items];
  items[0] = {
    ...head,
    reconfirmedAtMs: input.nowMs,
    reconfirmationNonce: input.nonce,
  };
  return {
    ok: true,
    duplicate: false,
    state: {
      ...state,
      mode: "queued",
      items,
      reason: null,
      dispatchPerformed: false,
    },
  };
}

export function markLensNextQueueHeadRetry(
  state: LensNextOfflineQueueState,
  nowMs: number,
): LensNextQueueChange {
  const head = state.items[0];
  if (!head || head.reconfirmedAtMs === null)
    return blocked(state, "RECONFIRMATION_REQUIRED");
  const attempts = head.attempts + 1;
  if (attempts > MAX_ATTEMPTS) return blocked(state, "RETRY_LIMIT_REACHED");
  const backoff = Math.min(1000 * 2 ** (attempts - 1), MAX_BACKOFF_MS);
  const items = [...state.items];
  items[0] = {
    ...head,
    attempts,
    nextRetryAtMs: nowMs + backoff,
    reconfirmedAtMs: null,
    reconfirmationNonce: null,
  };
  return {
    ok: true,
    duplicate: false,
    state: { ...state, items, dispatchPerformed: false },
  };
}

export const LENS_NEXT_OFFLINE_QUEUE_INVARIANTS = Object.freeze({
  maximumItems: MAX_ITEMS,
  maximumTotalBytes: MAX_TOTAL_BYTES,
  maximumItemBytes: MAX_ITEM_BYTES,
  maximumAttempts: MAX_ATTEMPTS,
  maximumBackoffMs: MAX_BACKOFF_MS,
  persistentStorageAllowed: false as const,
  networkBehavior: false as const,
  writeEndpointsAllowed: false as const,
  automaticConflictResolutionAllowed: false as const,
  dispatchPerformed: false as const,
});
