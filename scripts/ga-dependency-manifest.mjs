import { createHash } from 'node:crypto';
import { mapProjectDependencies } from './map-project-dependencies.mjs';
import { APPROVED_SAMPLE_CODES } from './ga-sample-allowlist.mjs';

// Validates an exported inventory. It does not connect to or mutate a database.
export function assessDependencyManifest(allowlist, inventory, graph = mapProjectDependencies()) {
  if (!allowlist?.identityReconciled || allowlist.executionAuthorized !== false)
    throw new Error('IDENTITY_RECONCILIATION_REQUIRED');
  if (!Array.isArray(allowlist.candidates) || allowlist.candidates.length !== APPROVED_SAMPLE_CODES.length
    || new Set(allowlist.candidates.map(row => row.id)).size !== APPROVED_SAMPLE_CODES.length
    || APPROVED_SAMPLE_CODES.some(code => allowlist.candidates.filter(row => row.code === code).length !== 1)
    || allowlist.candidates.some(row => !Number.isSafeInteger(row.id) || row.id < 1 || [23,26,35].includes(row.id)))
    throw new Error('EXACT_SAMPLE_SCOPE_REQUIRED');
  if (!inventory || !Array.isArray(inventory.projects)) throw new Error('INVENTORY_REQUIRED');
  const blockers = [];
  const expectedIds = new Set(allowlist.candidates.map(row => row.id));
  const seen = new Set();
  for (const project of inventory.projects) {
    if (!expectedIds.has(project.projectId) || seen.has(project.projectId)) throw new Error('INVENTORY_SCOPE_MISMATCH');
    seen.add(project.projectId);
    const tables = project.tables ?? {};
    for (const name of graph.completeProjectDependentTables) {
      const table = tables[name];
      if (!table || !Number.isSafeInteger(table.count) || table.count < 0
        || !Array.isArray(table.rowIds) || table.rowIds.length !== table.count
        || new Set(table.rowIds.map(String)).size !== table.count
        || table.rowIds.some(id => !['string','number'].includes(typeof id) || String(id).length === 0)
        || !/^[a-f0-9]{64}$/.test(table.exportSha256 ?? ''))
        blockers.push({ projectId: project.projectId, table: name, code: 'TABLE_EXPORT_NOT_PROVEN' });
    }
    for (const name of Object.keys(tables)) if (!graph.completeProjectDependentTables.includes(name))
      blockers.push({ projectId: project.projectId, table: name, code: 'UNMAPPED_TABLE' });
    if (!Array.isArray(project.objects)) blockers.push({ projectId: project.projectId, code: 'OBJECT_INVENTORY_MISSING' });
    else for (const object of project.objects) {
      if (!object.objectKey || !Array.isArray(object.ownerProjectIds) || object.ownerProjectIds.length !== 1
        || object.ownerProjectIds[0] !== project.projectId || object.ownershipVerified !== true)
        blockers.push({ projectId: project.projectId, code: 'SHARED_OR_UNPROVEN_OBJECT_OWNERSHIP' });
      if (!/^[a-f0-9]{64}$/.test(object.backupSha256 ?? '') || object.backupReadbackVerified !== true)
        blockers.push({ projectId: project.projectId, code: 'OBJECT_BACKUP_NOT_PROVEN' });
    }
    if (project.auditEvidenceOutsideDeletionScope !== true || project.integrationReferencesVerified !== true)
      blockers.push({ projectId: project.projectId, code: 'EXTERNAL_EVIDENCE_NOT_PROVEN' });
  }
  for (const id of expectedIds) if (!seen.has(id)) blockers.push({ projectId: id, code: 'PROJECT_INVENTORY_MISSING' });
  if (inventory.rosterSha256 !== allowlist.rosterSha256) blockers.push({ code: 'ROSTER_SNAPSHOT_MISMATCH' });
  return {
    schema: 'bimlog.ga-dependency-assessment.v1', operation: 'read_only_assessment',
    executionAuthorized: false, evidenceComplete: blockers.length === 0,
    schemaTableCount: graph.schemaTableCount, dependentTableCount: graph.completeProjectDependentTables.length,
    inventorySha256: createHash('sha256').update(JSON.stringify(inventory)).digest('hex'), blockers,
    limitation: 'Export declarations require independent verification against a fresh authoritative database and storage inventory before any purge.',
  };
}
