import assert from 'node:assert/strict';
import { executeVerifiedPurgeTransaction, processPurgeStorageItem } from './ga-purge-transaction.mjs';
import { previewSamplePurge } from './ga-purge-preview.mjs';
import { APPROVED_SAMPLE_CODES, reconcileSampleAllowlist } from './ga-sample-allowlist.mjs';
import { GA_PROTECTED_PROJECTS } from '../artifacts/api-server/src/lib/ga-protected-projects.ts';
const graph = { schemaTableCount: 2, completeProjectDependentTables: ['files'] };
const roster = [...GA_PROTECTED_PROJECTS.map(row => ({ ...row, status: 'active' })), ...APPROVED_SAMPLE_CODES.map((code,i) => ({ id: 10000+i, code, name: 'SYNTHETIC ONLY', status: 'archived' }))];
const list = reconcileSampleAllowlist(roster, GA_PROTECTED_PROJECTS);
const inventory = { rosterSha256: list.rosterSha256, projects: list.candidates.map(row => ({ projectId: row.id, tables: { files: { count: 1, rowIds: [row.id], exportSha256: 'a'.repeat(64) } }, objects: [], auditEvidenceOutsideDeletionScope: true, integrationReferencesVerified: true })) };
const input = { roster, inventory, confirmations: list.candidates, expectedRosterSha256: list.rosterSha256 };
const preview = previewSamplePurge(input, graph);
function fixture(failure) {
  let state = { projects: roster.map(row => row.id), rows: list.candidates.map(row => row.id), audit: [], outbox: [] };
  let digestReads = 0;
  const adapter = { transaction: async callback => {
    const before = structuredClone(state);
    try { return await callback({
      lockAndReadScope: async () => input,
      verifyBackupsAndStorageOwnership: async () => { if (failure === 'backup') throw new Error('BACKUP_FAILED'); },
      readUntouchedDependencyDigest: async () => failure === 'invariant' && digestReads++ ? 'b'.repeat(64) : 'a'.repeat(64),
      orderDependencyOperations: async () => list.candidates.map(row => ({ projectId: row.id, table: 'files' })),
      deleteExactRows: async exact => { state.rows = state.rows.filter(id => !exact.rowIds.includes(id)); return failure === 'rows' ? [999] : exact.rowIds; },
      deleteExactProject: async project => { state.projects = state.projects.filter(id => id !== project.id); return 1; },
      enqueueStorageCleanup: async item => { state.outbox.push(item); if (failure === 'outbox') throw new Error('OUTBOX_FAILED'); },
      appendExternalAudit: async item => { if (failure === 'audit') throw new Error('AUDIT_FAILED'); state.audit.push(item); },
    }); } catch (error) { state = before; throw error; }
  } };
  return { adapter, state: () => structuredClone(state) };
}
for (const failure of ['backup','rows','invariant','outbox','audit']) {
  const f = fixture(failure); const before = f.state();
  await assert.rejects(executeVerifiedPurgeTransaction(f.adapter, preview.previewSha256, graph));
  assert.deepEqual(f.state(), before, `rollback ${failure}`);
}
const f = fixture();
await assert.rejects(executeVerifiedPurgeTransaction(f.adapter, '0'.repeat(64), graph), /SCOPE_CHANGED/);
await executeVerifiedPurgeTransaction(f.adapter, preview.previewSha256, graph);
assert.deepEqual(f.state().projects, [23,26,35]);
assert.equal(f.state().rows.length, 0); assert.equal(f.state().audit.length, 1);
let item = { id: 'synthetic', state: 'pending' }; let fail = true; let calls = 0;
const storage = {
  withItemLock: async (_, callback) => callback(item),
  verifyExclusiveOwnershipAndBackup: async () => {},
  deleteExactObject: async () => { calls++; if (fail) throw new Error('synthetic failure'); },
  objectExists: async () => false,
  markDeleted: async () => { item.state = 'deleted'; },
  markRetryableFailure: async () => { item.state = 'retry_required'; },
};
assert.equal((await processPurgeStorageItem(storage, item)).state, 'retry_required');
fail = false;
assert.equal((await processPurgeStorageItem(storage, item)).state, 'deleted');
assert.equal((await processPurgeStorageItem(storage, item)).alreadyComplete, true);
assert.equal(calls, 2);
console.log('PASS synthetic purge protocol: rollback, stale preview, protected invariance, durable-outbox boundary and idempotent storage retry. Production adapter NOT implemented.');
