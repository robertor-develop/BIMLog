import { previewSamplePurge } from './ga-purge-preview.mjs';

// Internal transaction protocol, deliberately not registered as an HTTP route or CLI.
// The adapter must lock all scoped identities/dependencies before returning its input.
// Storage cleanup is a durable outbox operation committed with the database mutation.
export async function executeVerifiedPurgeTransaction(adapter, expectedPreviewSha256, graph) {
  if (!/^[a-f0-9]{64}$/.test(expectedPreviewSha256 ?? '')) throw new Error('PREVIEW_HASH_REQUIRED');
  return adapter.transaction(async tx => {
    const input = await tx.lockAndReadScope();
    const preview = previewSamplePurge(input, graph);
    if (!preview.readyForIndependentReview || preview.previewSha256 !== expectedPreviewSha256)
      throw new Error('PURGE_SCOPE_CHANGED');
    await tx.verifyBackupsAndStorageOwnership(preview);
    const invariantBefore = await tx.readUntouchedDependencyDigest(preview.untouchedProjectIds);
    if (!/^[a-f0-9]{64}$/.test(invariantBefore ?? '')) throw new Error('UNTOUCHED_DIGEST_REQUIRED');
    const receipts = [];
    // Adapter resolves the real FK dependency order; a report's JSON order is never executable order.
    const ordered = await tx.orderDependencyOperations(preview);
    const expected = new Map(preview.projects.flatMap(project => Object.entries(project.tables).map(([table, value]) => [
      `${project.id}:${table}`, { projectId: project.id, table, rowIds: value.rowIds, count: value.count },
    ])));
    if (!Array.isArray(ordered) || ordered.length !== expected.size) throw new Error('DEPENDENCY_ORDER_INCOMPLETE');
    const seen = new Set();
    for (const operation of ordered) {
      const key = `${operation.projectId}:${operation.table}`;
      const exact = expected.get(key);
      if (!exact || seen.has(key)) throw new Error('DEPENDENCY_SCOPE_MISMATCH');
      seen.add(key);
      const deletedIds = await tx.deleteExactRows(exact);
      const normalize = ids => ids.map(String).sort();
      if (!Array.isArray(deletedIds) || JSON.stringify(normalize(deletedIds)) !== JSON.stringify(normalize(exact.rowIds)))
        throw new Error('DELETED_ROWS_MISMATCH');
      receipts.push({ projectId: exact.projectId, table: exact.table, count: deletedIds.length });
    }
    for (const project of preview.projects) {
      if (await tx.deleteExactProject({ id: project.id, code: project.code }) !== 1)
        throw new Error('PROJECT_DELETE_MISMATCH');
    }
    if (await tx.readUntouchedDependencyDigest(preview.untouchedProjectIds) !== invariantBefore)
      throw new Error('UNTOUCHED_DATA_CHANGED');
    const objects = preview.projects.flatMap(project => project.objects.map(object => ({ ...object, projectId: project.id })));
    await tx.enqueueStorageCleanup({ previewSha256: expectedPreviewSha256, objects });
    await tx.appendExternalAudit({ previewSha256: expectedPreviewSha256, receipts, protectedDigest: invariantBefore, storageState: objects.length ? 'pending' : 'not_required' });
    return { databaseState: 'committed_on_transaction_success', storageState: objects.length ? 'pending' : 'not_required', receipts };
  });
}

// A durable worker retries only unfinished objects; it must recheck exclusive ownership
// and retained backup bytes every attempt. Never claim an object deleted on an exception.
export async function processPurgeStorageItem(adapter, item) {
  return adapter.withItemLock(item.id, async locked => {
    if (locked.state === 'deleted') return { state: 'deleted', alreadyComplete: true };
    await adapter.verifyExclusiveOwnershipAndBackup(locked);
    try {
      await adapter.deleteExactObject(locked);
      if (await adapter.objectExists(locked)) throw new Error('OBJECT_STILL_PRESENT');
      await adapter.markDeleted(locked);
      return { state: 'deleted', alreadyComplete: false };
    } catch {
      await adapter.markRetryableFailure(locked, 'STORAGE_CLEANUP_FAILED');
      return { state: 'retry_required' };
    }
  });
}
