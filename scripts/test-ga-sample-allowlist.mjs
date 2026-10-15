import assert from 'node:assert/strict';
import { APPROVED_SAMPLE_CODES, reconcileSampleAllowlist } from './ga-sample-allowlist.mjs';
import { GA_PROTECTED_PROJECTS } from '../artifacts/api-server/src/lib/ga-protected-projects.ts';

const protectedRows = GA_PROTECTED_PROJECTS.map(row => ({ ...row, status: 'active' }));
// IDs are deliberately synthetic and are never exported as production evidence.
const samples = APPROVED_SAMPLE_CODES.map((code, i) => ({ id: 10000+i, code, name: `SYNTHETIC ${code}`, status: 'archived' }));
const temporary = { id: 20000, code: 'QA-GAUNTLET-1014', name: 'SYNTHETIC temporary', status: 'active' };
const roster = [...protectedRows, ...samples, temporary];
const original = JSON.stringify(roster);
const reconcile = rows => reconcileSampleAllowlist(rows, GA_PROTECTED_PROJECTS);
const result = reconcile(roster);
assert.equal(result.identityReconciled, true);
assert.equal(result.executionAuthorized, false);
assert.equal(result.candidates.length, 14);
assert.deepEqual(result.untouchedProjectIds, [23,26,35,20000]);
assert.equal(JSON.stringify(roster), original);
assert.equal(reconcile([...roster].reverse()).rosterSha256, result.rosterSha256);
assert.equal(reconcile(roster.filter(row => row.id !== 23)).identityReconciled, false);
assert.equal(reconcile(roster.filter(row => row.id !== 10000)).identityReconciled, false);
assert.equal(reconcile([...roster, { ...samples[0], id: 30000 }]).identityReconciled, false);
assert.throws(() => reconcile([...roster, { ...samples[0] }]), /DUPLICATE_PROJECT_ID/);
assert.equal(reconcile(roster.map(row => row.id === 23 ? { ...row, code: samples[0].code } : row)).identityReconciled, false);
assert.equal(reconcile(roster.map(row => row.id === 10000 ? { ...row, code: row.code+' ' } : row)).identityReconciled, false);
assert.equal(reconcile(roster.map(row => row.id === 26 ? { ...row, status: 'archived' } : row)).identityReconciled, false);
assert.throws(() => reconcile([{ id: '23', code: 'IBQ-LIT', name: 'invalid', status: 'active' }]), /INVALID_PROJECT_IDENTITY/);
console.log('PASS B-GA006 synthetic allowlist reconciliation; no production identity or deletion acceptance claimed');
