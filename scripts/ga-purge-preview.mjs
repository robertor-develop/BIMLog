import { createHash } from 'node:crypto';
import { reconcileSampleAllowlist } from './ga-sample-allowlist.mjs';
import { assessDependencyManifest } from './ga-dependency-manifest.mjs';
import { GA_PROTECTED_PROJECTS } from '../artifacts/api-server/src/lib/ga-protected-projects.ts';

// B-GA008 preview boundary only: no production execution adapter is exposed.
export function previewSamplePurge({ roster, inventory, confirmations, expectedRosterSha256 }, graph) {
  const allowlist = reconcileSampleAllowlist(roster, GA_PROTECTED_PROJECTS);
  if (!allowlist.identityReconciled) throw new Error('PROJECT_IDENTITIES_NOT_RECONCILED');
  if (allowlist.rosterSha256 !== expectedRosterSha256) throw new Error('PURGE_PREVIEW_STALE');
  if (!Array.isArray(confirmations) || confirmations.length !== allowlist.candidates.length
    || allowlist.candidates.some(row => confirmations.filter(value => value.id === row.id && value.code === row.code).length !== 1))
    throw new Error('EXACT_CONFIRMATIONS_REQUIRED');
  const assessment = assessDependencyManifest(allowlist, inventory, graph);
  if (!assessment.evidenceComplete) return { readyForIndependentReview: false, executionAuthorized: false, blockers: assessment.blockers };
  const objectKeys = new Set();
  for (const project of inventory.projects) for (const object of project.objects) {
    if (objectKeys.has(object.objectKey)) throw new Error('CROSS_PROJECT_OR_DUPLICATE_OBJECT');
    objectKeys.add(object.objectKey);
  }
  const body = {
    schema: 'bimlog.ga-purge-preview.v1', operation: 'dry_run_only', executionAuthorized: false,
    rosterSha256: allowlist.rosterSha256, inventorySha256: assessment.inventorySha256,
    projects: allowlist.candidates.map(row => {
      const project = inventory.projects.find(value => value.projectId === row.id);
      return { ...row, tables: project.tables, objects: project.objects };
    }),
    untouchedProjectIds: allowlist.untouchedProjectIds,
    requiredExecutionChecks: ['fresh_transactional_identity_and_scope_check', 'verified_backup_readback', 'independent_storage_ownership_check', 'preserved_external_audit', 'protected_dependency_invariance'],
  };
  // Detach the report from mutable input references before binding its hash.
  const report = JSON.parse(JSON.stringify(body));
  return { ...report, readyForIndependentReview: true, previewSha256: createHash('sha256').update(JSON.stringify(report)).digest('hex') };
}
