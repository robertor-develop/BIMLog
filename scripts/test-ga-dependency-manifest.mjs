import assert from 'node:assert/strict';
import { assessDependencyManifest } from './ga-dependency-manifest.mjs';
import { APPROVED_SAMPLE_CODES } from './ga-sample-allowlist.mjs';
const hash = 'a'.repeat(64);
const list = { identityReconciled: true, executionAuthorized: false, rosterSha256: hash, candidates: APPROVED_SAMPLE_CODES.map((code, i) => ({ id: 10000+i, code })) };
const graph = { schemaTableCount: 3, completeProjectDependentTables: ['files', 'members'] };
const project = { projectId: 10000, tables: Object.fromEntries(graph.completeProjectDependentTables.map(name => [name, { count: 1, rowIds: [1], exportSha256: hash }])), objects: [{ objectKey: 'synthetic', ownerProjectIds: [10000], ownershipVerified: true, backupSha256: hash, backupReadbackVerified: true }], auditEvidenceOutsideDeletionScope: true, integrationReferencesVerified: true };
const input = { rosterSha256: hash, projects: list.candidates.map(row => ({ ...project, projectId: row.id, objects: [{ ...project.objects[0], ownerProjectIds: [row.id] }] })) };
const check = value => assessDependencyManifest(list, value, graph);
assert.equal(check(input).evidenceComplete, true);
assert.equal(check(input).executionAuthorized, false);
assert.throws(() => assessDependencyManifest({ ...list, candidates: [] }, input, graph), /EXACT_SAMPLE_SCOPE_REQUIRED/);
assert.equal(check({ ...input, projects: [] }).evidenceComplete, false);
assert.equal(check({ ...input, rosterSha256: 'stale' }).evidenceComplete, false);
assert.throws(() => check({ ...input, projects: [project, project] }), /SCOPE_MISMATCH/);
assert.throws(() => check({ ...input, projects: [{ ...project, projectId: 23 }] }), /SCOPE_MISMATCH/);
for (const change of [
  { tables: {} }, { objects: undefined },
  { objects: [{ ...project.objects[0], ownerProjectIds: [10000, 23] }] },
  { objects: [{ ...project.objects[0], backupReadbackVerified: false }] },
  { auditEvidenceOutsideDeletionScope: false }, { integrationReferencesVerified: false },
  { auditEvidenceOutsideDeletionScope: 'false' }, { integrationReferencesVerified: 'false' },
  { tables: { ...project.tables, files: { count: 2, rowIds: [1,1], exportSha256: hash } } },
]) assert.equal(check({ ...input, projects: input.projects.map((row, index) => index === 0 ? { ...row, ...change } : row) }).evidenceComplete, false);
console.log('PASS B-GA007 synthetic inventory assessment rejects incomplete or shared ownership evidence');
