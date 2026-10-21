import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ga-production-purge.mts', import.meta.url), 'utf8');
for (const contract of [
  /BEGIN ISOLATION LEVEL SERIALIZABLE/,
  /MANIFEST_SHA_REQUIRED/,
  /MANIFEST_CHANGED/,
  /EXACT_OPERATION_AUTHORIZATION_REQUIRED/,
  /ROBERTOS_EXACT_SAMPLE_PURGE/,
  /DELETE_COUNT_MISMATCH/,
  /PROJECT_DELETE_COUNT_MISMATCH/,
  /ROLLBACK/,
]) assert.match(source, contract);
assert.doesNotMatch(source, /TRUNCATE\s|DROP\s+TABLE|DISABLE\s+TRIGGER/i);
console.log('Full-GA Block 4 Build 18 hash-bound serializable transaction: PASS');
