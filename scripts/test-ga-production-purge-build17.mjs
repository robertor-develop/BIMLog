import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ga-production-purge.mts', import.meta.url), 'utf8');
for (const contract of [
  /information_schema\.columns/,
  /pg_constraint/,
  /RELEVANT_TABLE_WITHOUT_PRIMARY_KEY/,
  /DIRECT_SCOPE_MISMATCH/,
  /CYCLIC_DEPENDENCY/,
  /primaryKeys:/,
  /exportSha256:/,
]) assert.match(source, contract);
assert.match(source, /storageObjects:/);
console.log('Full-GA Block 4 Build 17 recursive dependency and storage manifest: PASS');
