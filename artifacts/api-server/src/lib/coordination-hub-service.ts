import { z } from "zod/v4";

const boundedId = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const provider = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);

export const coordinationScopeSchema = z.object({
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  actorUserId: z.number().int().positive(),
}).strict();

export const registerCoordinationRevisionCommandSchema = z.object({
  scope: coordinationScopeSchema,
  file: z.object({
    id: boundedId,
    stableKey: boundedId,
    category: z.string().trim().min(1).max(128),
    tradeId: z.number().int().positive().nullable(),
  }).strict(),
  revision: z.object({
    id: boundedId,
    revisionNumber: z.number().int().positive(),
    sourceFileId: z.number().int().positive().nullable(),
    provider,
    providerItemId: boundedId,
    providerVersionId: boundedId,
    contentSha256: digest,
    byteSize: z.number().int().nonnegative(),
  }).strict(),
  designateCurrent: z.boolean(),
  expectedCurrentRevisionId: boundedId.nullable(),
}).strict().superRefine((command, context) => {
  if (!command.designateCurrent && command.expectedCurrentRevisionId !== null) {
    context.addIssue({ code: "custom", path: ["expectedCurrentRevisionId"], message: "Expected current revision is valid only for an explicit designation" });
  }
});

export const enqueueCoordinationJobCommandSchema = z.object({
  scope: coordinationScopeSchema,
  job: z.object({
    id: boundedId,
    credentialId: boundedId,
    provider,
    jobType: z.enum(["discover", "import_revision", "reconcile", "publish", "verify"]),
    idempotencyKey: boundedId,
    requestDigest: digest,
    payload: z.record(z.string(), z.unknown()),
    maxAttempts: z.number().int().min(1).max(20).default(5),
  }).strict(),
}).strict();

export type CoordinationScope = z.infer<typeof coordinationScopeSchema>;
export type RegisterCoordinationRevisionCommand = z.infer<typeof registerCoordinationRevisionCommandSchema>;
export type EnqueueCoordinationJobCommand = z.infer<typeof enqueueCoordinationJobCommandSchema>;

export type CoordinationFileRecord = RegisterCoordinationRevisionCommand["file"] & Pick<CoordinationScope, "projectId" | "companyId"> & { createdById: number };
export type CoordinationRevisionRecord = RegisterCoordinationRevisionCommand["revision"] & { coordinationFileId: string; projectId: number; createdById: number };
export type CoordinationJobRecord = EnqueueCoordinationJobCommand["job"] & Pick<CoordinationScope, "projectId" | "companyId"> & { createdById: number };

export interface CoordinationHubTransaction {
  assertProjectCompanyAuthority(scope: CoordinationScope): Promise<void>;
  findFileByStableKey(projectId: number, stableKey: string): Promise<CoordinationFileRecord | null>;
  insertFile(record: CoordinationFileRecord): Promise<void>;
  findRevisionByProviderIdentity(provider: string, providerItemId: string, providerVersionId: string): Promise<CoordinationRevisionRecord | null>;
  insertRevision(record: CoordinationRevisionRecord): Promise<void>;
  currentRevisionId(coordinationFileId: string): Promise<string | null>;
  designateCurrentRevision(input: { coordinationFileId: string; revisionId: string; expectedCurrentRevisionId: string | null; actorUserId: number }): Promise<void>;
  findJobByIdempotency(input: { companyId: number; projectId: number; provider: string; jobType: string; idempotencyKey: string }): Promise<CoordinationJobRecord | null>;
  insertJob(record: CoordinationJobRecord): Promise<void>;
}

export interface CoordinationHubStore {
  transaction<T>(work: (transaction: CoordinationHubTransaction) => Promise<T>): Promise<T>;
}

export class CoordinationConflictError extends Error {
  readonly code = "COORDINATION_CONFLICT";
}

function sameFile(left: CoordinationFileRecord, right: CoordinationFileRecord): boolean {
  return left.id === right.id && left.projectId === right.projectId && left.companyId === right.companyId && left.stableKey === right.stableKey && left.category === right.category && left.tradeId === right.tradeId && left.createdById === right.createdById;
}

function sameRevision(left: CoordinationRevisionRecord, right: CoordinationRevisionRecord): boolean {
  return left.id === right.id && left.coordinationFileId === right.coordinationFileId && left.projectId === right.projectId && left.revisionNumber === right.revisionNumber && left.sourceFileId === right.sourceFileId && left.provider === right.provider && left.providerItemId === right.providerItemId && left.providerVersionId === right.providerVersionId && left.contentSha256 === right.contentSha256 && left.byteSize === right.byteSize && left.createdById === right.createdById;
}

export class CoordinationHubService {
  constructor(private readonly store: CoordinationHubStore) {}

  async registerRevision(input: unknown): Promise<{ result: "created" | "idempotent"; currentRevisionId: string | null }> {
    const command = registerCoordinationRevisionCommandSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      await transaction.assertProjectCompanyAuthority(command.scope);
      const fileRecord: CoordinationFileRecord = { ...command.file, projectId: command.scope.projectId, companyId: command.scope.companyId, createdById: command.scope.actorUserId };
      const existingFile = await transaction.findFileByStableKey(command.scope.projectId, command.file.stableKey);
      if (existingFile && !sameFile(existingFile, fileRecord)) throw new CoordinationConflictError("Stable Coordination File identity conflicts with the requested scope or classification");
      if (!existingFile) await transaction.insertFile(fileRecord);

      const revisionRecord: CoordinationRevisionRecord = { ...command.revision, coordinationFileId: command.file.id, projectId: command.scope.projectId, createdById: command.scope.actorUserId };
      const existingRevision = await transaction.findRevisionByProviderIdentity(command.revision.provider, command.revision.providerItemId, command.revision.providerVersionId);
      if (existingRevision && !sameRevision(existingRevision, revisionRecord)) throw new CoordinationConflictError("Provider revision identity conflicts with immutable revision evidence");
      if (!existingRevision) await transaction.insertRevision(revisionRecord);

      let currentRevisionId = await transaction.currentRevisionId(command.file.id);
      if (command.designateCurrent && currentRevisionId !== command.revision.id) {
        if (currentRevisionId !== command.expectedCurrentRevisionId) throw new CoordinationConflictError("Current revision changed after the caller observed it");
        await transaction.designateCurrentRevision({ coordinationFileId: command.file.id, revisionId: command.revision.id, expectedCurrentRevisionId: command.expectedCurrentRevisionId, actorUserId: command.scope.actorUserId });
        currentRevisionId = command.revision.id;
      }
      return { result: existingRevision ? "idempotent" : "created", currentRevisionId };
    });
  }

  async enqueueJob(input: unknown): Promise<{ result: "queued" | "idempotent"; jobId: string }> {
    const command = enqueueCoordinationJobCommandSchema.parse(input);
    return this.store.transaction(async (transaction) => {
      await transaction.assertProjectCompanyAuthority(command.scope);
      const identity = { companyId: command.scope.companyId, projectId: command.scope.projectId, provider: command.job.provider, jobType: command.job.jobType, idempotencyKey: command.job.idempotencyKey };
      const existing = await transaction.findJobByIdempotency(identity);
      if (existing) {
        if (existing.requestDigest !== command.job.requestDigest) throw new CoordinationConflictError("Idempotency key was reused with a different request digest");
        return { result: "idempotent", jobId: existing.id };
      }
      await transaction.insertJob({ ...command.job, companyId: command.scope.companyId, projectId: command.scope.projectId, createdById: command.scope.actorUserId });
      return { result: "queued", jobId: command.job.id };
    });
  }
}
