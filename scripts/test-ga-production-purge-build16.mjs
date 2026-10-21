import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ga-production-purge.mts', import.meta.url), 'utf8');
const targets = ['ROB-T1','QA-P19-0914','QA-P21-E2E-0914','QA-P22-E2E-0914','QA-P23-E2E-0914','QA-P24-0915','QA-P25-0915','QA-LOR-0916','ROBERTOSNTEST','QA-AI-0924','QA-INT-B-0924','QA-C020-FUNDS','QA-C020-MATCH','PRJROB-T'];
const protectedCodes = ['IBQ-LIT','ELA01','PRO-521-TEST','QA-GAUNTLET-1014'];
for (const code of [...targets, ...protectedCodes])
  assert.equal(source.split(`'${code}'`).length - 1, 1, `${code} must have one exact ID/code binding`);
assert.match(source, /ROSTER_COUNT_MISMATCH/);
assert.match(source, /ROSTER_IDENTITY_MISMATCH/);
assert.match(source, /FOR UPDATE/);
assert.doesNotMatch(source, /name\s+LIKE|code\s+LIKE/i);
console.log('Full-GA Block 4 Build 16 exact production roster identity: PASS');
