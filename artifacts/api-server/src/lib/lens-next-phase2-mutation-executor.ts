import { createHash } from "node:crypto";
import type {
  LensNextHeldMutationPlan,
  LensNextPhase2Action,
  LensNextPhase2MutationRequest,
} from "./lens-next-phase2-mutation-contract";

export const LENS_NEXT_PHASE2_EXECUTOR_VERSION =
  "lens-next-phase2-sandbox-executor.v1" as const;
export const LENS_NEXT_PHASE2_PRODUCTION_ENABLED = false as const;

export interface LensNextValidatedHeldMutation {
  request: LensNextPhase2MutationRequest;
  plan: LensNextHeldMutationPlan;
  visualStateDigest: string;
}

export interface LensNextMutationRow {
  projectId: number;
  serverId: number;
  viewpointId: string;
  issueFamilyId: string;
  lifecycleStatus: "active" | "superseded" | "voided";
  revisionNumber: number;
  version: number;
  status: string;
  visualStateDigest: string;
  comments: readonly string[];
  assigneeUserId: string | null;
  responsibleCompanyId: string | null;
}

export interface LensNextMutationResult {
  identity: Pick<
    LensNextMutationRow,
    | "projectId"
    | "serverId"
    | "viewpointId"
    | "issueFamilyId"
    | "lifecycleStatus"
    | "revisionNumber"
  >;
  version: number;
  status: string;
  visualStateDigest: string;
  action: LensNextPhase2Action;
}

export interface LensNextMutationReceipt {
  receiptId: string;
  scopeKey: string;
  requestFingerprint: string;
  action: LensNextPhase2Action;
  actorId: string;
  result: LensNextMutationResult;
}

export interface LensNextMutationAudit {
  action: LensNextPhase2Action;
  actorId: string;
  projectId: number;
  serverId: number;
  issueFamilyId: string;
  revisionNumber: number;
  idempotencyId: string;
  previousVersion: number;
  resultingVersion: number;
  visualStateDigest: string;
}

export interface LensNextMutationTransaction {
  findReceipt(scopeKey: string): Promise<LensNextMutationReceipt | null>;
  mutateIfPreconditionsMatch(input: {
    request: LensNextPhase2MutationRequest;
    visualStateDigest: string;
  }): Promise<LensNextMutationRow | null>;
  appendAudit(audit: LensNextMutationAudit): Promise<void>;
  saveReceipt(receipt: LensNextMutationReceipt): Promise<void>;
}

export interface LensNextMutationStore {
  transaction<T>(
    operation: (tx: LensNextMutationTransaction) => Promise<T>,
  ): Promise<T>;
}

export type LensNextMutationExecution =
  | {
      ok: true;
      replayed: boolean;
      productionEnabled: false;
      mutationAllowed: true;
      receipt: LensNextMutationReceipt;
      result: LensNextMutationResult;
    }
  | {
      ok: false;
      status: 400 | 409;
      code:
        | "HELD_REQUEST_INVALID"
        | "PRECONDITION_CONFLICT"
        | "IDEMPOTENCY_REPLAY_MISMATCH";
      productionEnabled: false;
      mutationAllowed: false;
    };

const SHA256 = /^[0-9a-f]{64}$/i;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

function validHeldInput(input: LensNextValidatedHeldMutation) {
  const { request, plan, visualStateDigest } = input;
  return (
    plan.status === "HELD_CONTRACT_ONLY" &&
    plan.mutationAllowed === false &&
    plan.authorityGranted === false &&
    plan.action === request.action &&
    plan.identity.projectId === request.projectId &&
    plan.identity.serverId === request.serverId &&
    plan.identity.viewpointId === request.viewpointId &&
    plan.identity.issueFamilyId === request.issueFamilyId &&
    plan.identity.lifecycleStatus === request.lifecycleStatus &&
    plan.identity.revisionNumber === request.revisionNumber &&
    request.lifecycleStatus === "active" &&
    request.precondition.expectedRevisionNumber === request.revisionNumber &&
    request.permissionEvidence.subjectId === request.actorId &&
    request.permissionEvidence.action === request.action &&
    request.permissionEvidence.projectId === request.projectId &&
    request.permissionEvidence.serverId === request.serverId &&
    request.pilotPolicy.projectId === request.projectId &&
    request.pilotPolicy.pilotUserId === request.actorId &&
    request.pilotPolicy.productionWriteAllowed === false &&
    SHA256.test(visualStateDigest) &&
    Object.values(plan.executionRequirements).every((value) => value === true)
  );
}

function resultFromRow(
  action: LensNextPhase2Action,
  row: LensNextMutationRow,
): LensNextMutationResult {
  return {
    identity: {
      projectId: row.projectId,
      serverId: row.serverId,
      viewpointId: row.viewpointId,
      issueFamilyId: row.issueFamilyId,
      lifecycleStatus: row.lifecycleStatus,
      revisionNumber: row.revisionNumber,
    },
    version: row.version,
    status: row.status,
    visualStateDigest: row.visualStateDigest,
    action,
  };
}

export async function executeLensNextPhase2SandboxMutation(
  input: LensNextValidatedHeldMutation,
  store: LensNextMutationStore,
): Promise<LensNextMutationExecution> {
  if (!validHeldInput(input)) {
    return {
      ok: false,
      status: 400,
      code: "HELD_REQUEST_INVALID",
      productionEnabled: false,
      mutationAllowed: false,
    };
  }

  const { request, visualStateDigest } = input;
  const scopeKey = [
    request.actorId,
    request.action,
    request.projectId,
    request.serverId,
    request.revisionNumber,
    request.idempotencyId,
  ].join(":");
  const requestFingerprint = sha256({ request, visualStateDigest });

  return store.transaction(async (tx) => {
    const prior = await tx.findReceipt(scopeKey);
    if (prior) {
      if (prior.requestFingerprint !== requestFingerprint) {
        return {
          ok: false,
          status: 409,
          code: "IDEMPOTENCY_REPLAY_MISMATCH",
          productionEnabled: false,
          mutationAllowed: false,
        };
      }
      return {
        ok: true,
        replayed: true,
        productionEnabled: false,
        mutationAllowed: true,
        receipt: prior,
        result: prior.result,
      };
    }

    const row = await tx.mutateIfPreconditionsMatch({
      request,
      visualStateDigest,
    });
    if (!row || row.visualStateDigest !== visualStateDigest) {
      return {
        ok: false,
        status: 409,
        code: "PRECONDITION_CONFLICT",
        productionEnabled: false,
        mutationAllowed: false,
      };
    }

    const result = resultFromRow(request.action, row);
    const receipt: LensNextMutationReceipt = {
      receiptId: `lens-next-phase2:${sha256({ scopeKey, requestFingerprint, result })}`,
      scopeKey,
      requestFingerprint,
      action: request.action,
      actorId: request.actorId,
      result,
    };
    await tx.appendAudit({
      action: request.action,
      actorId: request.actorId,
      projectId: request.projectId,
      serverId: request.serverId,
      issueFamilyId: request.issueFamilyId,
      revisionNumber: request.revisionNumber,
      idempotencyId: request.idempotencyId,
      previousVersion: request.precondition.expectedVersion,
      resultingVersion: row.version,
      visualStateDigest,
    });
    await tx.saveReceipt(receipt);
    return {
      ok: true,
      replayed: false,
      productionEnabled: false,
      mutationAllowed: true,
      receipt,
      result,
    };
  });
}
