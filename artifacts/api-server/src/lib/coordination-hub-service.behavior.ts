import assert from "node:assert/strict";
import { CoordinationConflictError, CoordinationHubService, type CoordinationFileRecord, type CoordinationHubStore, type CoordinationHubTransaction, type CoordinationJobRecord, type CoordinationRevisionRecord } from "./coordination-hub-service";

const files = new Map<string, CoordinationFileRecord>();
const revisions = new Map<string, CoordinationRevisionRecord>();
const currents = new Map<string, string>();
const jobs = new Map<string, CoordinationJobRecord>();
let authorityChecks = 0;
let transactions = 0;

const transaction: CoordinationHubTransaction = {
  assertProjectCompanyAuthority: async (scope) => { authorityChecks += 1; if (scope.projectId !== 7 || scope.companyId !== 3) throw new Error("forbidden"); },
  findFileByStableKey: async (projectId, stableKey) => files.get(`${projectId}:${stableKey}`) ?? null,
  insertFile: async (record) => { files.set(`${record.projectId}:${record.stableKey}`, record); },
  findRevisionByProviderIdentity: async (provider, item, version) => revisions.get(`${provider}:${item}:${version}`) ?? null,
  insertRevision: async (record) => { revisions.set(`${record.provider}:${record.providerItemId}:${record.providerVersionId}`, record); },
  currentRevisionId: async (fileId) => currents.get(fileId) ?? null,
  designateCurrentRevision: async ({ coordinationFileId, revisionId, expectedCurrentRevisionId }) => {
    assert.equal(currents.get(coordinationFileId) ?? null, expectedCurrentRevisionId);
    currents.set(coordinationFileId, revisionId);
  },
  findJobByIdempotency: async ({ companyId, projectId, provider, jobType, idempotencyKey }) => jobs.get(`${companyId}:${projectId}:${provider}:${jobType}:${idempotencyKey}`) ?? null,
  insertJob: async (record) => { jobs.set(`${record.companyId}:${record.projectId}:${record.provider}:${record.jobType}:${record.idempotencyKey}`, record); },
};
const store: CoordinationHubStore = { transaction: async (work) => { transactions += 1; return work(transaction); } };
const service = new CoordinationHubService(store);
const scope = { projectId: 7, companyId: 3, actorUserId: 11 };
const revisionCommand = {
  scope,
  file: { id: "coord-file-1", stableKey: "coordination/mechanical/level-02", category: "coordination", tradeId: 9 },
  revision: { id: "revision-1", revisionNumber: 1, sourceFileId: 81, provider: "sharepoint", providerItemId: "item-1", providerVersionId: "version-1", contentSha256: "a".repeat(64), byteSize: 2048 },
  designateCurrent: true,
  expectedCurrentRevisionId: null,
};

assert.deepEqual(await service.registerRevision(revisionCommand), { result: "created", currentRevisionId: "revision-1" });
assert.deepEqual(await service.registerRevision(revisionCommand), { result: "idempotent", currentRevisionId: "revision-1" });
await assert.rejects(() => service.registerRevision({ ...revisionCommand, revision: { ...revisionCommand.revision, contentSha256: "b".repeat(64) } }), CoordinationConflictError);
await assert.rejects(() => service.registerRevision({ ...revisionCommand, scope: { ...scope, companyId: 4 } }), /forbidden/);

const jobCommand = { scope, job: { id: "job-1", credentialId: "credential-1", provider: "sharepoint", jobType: "discover", idempotencyKey: "discover-project-7", requestDigest: "c".repeat(64), payload: { projectId: 7 }, maxAttempts: 5 } };
assert.deepEqual(await service.enqueueJob(jobCommand), { result: "queued", jobId: "job-1" });
assert.deepEqual(await service.enqueueJob(jobCommand), { result: "idempotent", jobId: "job-1" });
await assert.rejects(() => service.enqueueJob({ ...jobCommand, job: { ...jobCommand.job, requestDigest: "d".repeat(64) } }), CoordinationConflictError);
assert.equal(files.size, 1);
assert.equal(revisions.size, 1);
assert.equal(jobs.size, 1);
assert.equal(authorityChecks, 7);
assert.equal(transactions, 7);
console.log("coordination hub service behavior: PASS");
