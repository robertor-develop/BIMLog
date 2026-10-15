import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const APPROVED_SAMPLE_CODES = Object.freeze([
  'QA-P19-0914', 'QA-P21-E2E-0914', 'QA-P22-E2E-0914', 'QA-P23-E2E-0914',
  'QA-P24-0915', 'QA-P25-0915', 'QA-AI-0924', 'QA-INT-B-0924',
  'QA-LOR-0916', 'ROB-T1', 'PRJROB-T', 'ROBERTOSNTEST', 'QA-C020-FUNDS', 'QA-C020-MATCH',
]);

// Reconciliation only. This module has no database, storage or deletion client.
export function reconcileSampleAllowlist(roster, protectedProjects) {
  if (!Array.isArray(roster) || !Array.isArray(protectedProjects) || protectedProjects.length !== 3)
    throw new Error('INVALID_ROSTER_INPUT');
  const ids = new Set();
  for (const row of roster) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || typeof row.code !== 'string'
      || typeof row.name !== 'string' || !row.name.trim() || typeof row.status !== 'string')
      throw new Error('INVALID_PROJECT_IDENTITY');
    if (ids.has(row.id)) throw new Error('DUPLICATE_PROJECT_ID');
    ids.add(row.id);
  }
  const blockers = [];
  for (const expected of protectedProjects) {
    const matches = roster.filter(row => row.id === expected.id || row.code === expected.code);
    if (matches.length !== 1 || matches[0].id !== expected.id || matches[0].code !== expected.code
      || matches[0].name !== expected.name || matches[0].status !== 'active')
      blockers.push({ code: 'PROTECTED_IDENTITY_MISMATCH', projectId: expected.id });
  }
  const protectedIds = new Set(protectedProjects.map(row => row.id));
  const candidates = [];
  for (const code of APPROVED_SAMPLE_CODES) {
    const matches = roster.filter(row => row.code === code);
    if (matches.length !== 1) { blockers.push({ code: 'SAMPLE_CODE_NOT_UNIQUE', projectCode: code }); continue; }
    const row = matches[0];
    if (protectedIds.has(row.id)) { blockers.push({ code: 'PROTECTED_ID_IN_SAMPLE', projectId: row.id }); continue; }
    candidates.push({ id: row.id, code: row.code, name: row.name, status: row.status });
  }
  const body = {
    schema: 'bimlog.ga-sample-allowlist.v1', operation: 'read_only_reconciliation',
    identityReconciled: blockers.length === 0, executionAuthorized: false,
    // A complete authoritative roster is required; this hash binds its exact identities.
    rosterSha256: createHash('sha256').update(JSON.stringify([...roster].sort((a,b) => a.id-b.id))).digest('hex'),
    candidates, blockers,
    untouchedProjectIds: roster.filter(row => !candidates.some(candidate => candidate.id === row.id)).map(row => row.id).sort((a,b) => a-b),
    requiredBeforeExecution: ['authoritative_roster_verification', 'dependency_manifest', 'shared_storage_ownership', 'fresh_identity_recheck', 'protected_project_invariance'],
  };
  return body;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3) throw new Error('Usage: node scripts/ga-sample-allowlist.mjs <authoritative-roster.json>');
  const { GA_PROTECTED_PROJECTS } = await import('../artifacts/api-server/src/lib/ga-protected-projects.ts');
  const result = reconcileSampleAllowlist(JSON.parse(fs.readFileSync(input, 'utf8')), GA_PROTECTED_PROJECTS);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.identityReconciled) process.exitCode = 1;
}
