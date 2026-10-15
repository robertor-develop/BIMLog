import assert from 'node:assert/strict';
import { latestConventionVersion } from '../artifacts/bimlog/src/lib/convention-version-selection.ts';
const older = { conventionVersion: 1, acceptedDisciplines: ['ARC'] };
const newer = { conventionVersion: 2, acceptedDisciplines: [] };
const versions = [older, newer];
assert.equal(latestConventionVersion(versions), newer);
assert.equal(latestConventionVersion([...versions].reverse()), newer);
assert.deepEqual(versions, [older, newer]);
assert.equal(latestConventionVersion([]), null);
for (const invalid of [[older, older], [{ conventionVersion: 0 }], [{ conventionVersion: '2' }], [null], null])
  assert.throws(() => latestConventionVersion(invalid));
console.log('PASS latest convention selection preserves accepted empty catalogs and rejects ambiguous history');
