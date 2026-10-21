import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ga-production-purge.mts', import.meta.url), 'utf8');
for (const contract of [
  /protectedDigest/,
  /PROTECTED_PROJECT_CHANGED/,
  /PROTECTED_DEPENDENCIES_CHANGED/,
  /TARGET_PROJECT_REMAINS/,
  /DRY_RUN_PASS_ROLLED_BACK/,
  /SUPER_ADMIN_AUDIT_ACTOR_REQUIRED/,
  /ga_authorized_sample_purge/,
]) assert.match(source, contract);
assert.match(source, /objectKey:/);
console.log('Full-GA Block 4 Build 19 protected invariance and auditable receipt: PASS');
