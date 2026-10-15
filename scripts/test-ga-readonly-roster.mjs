import assert from 'node:assert/strict';
import { readAuthoritativeRoster } from './ga-readonly-roster.mjs';
import { GA_PROTECTED_PROJECTS } from '../artifacts/api-server/src/lib/ga-protected-projects.ts';
import { APPROVED_SAMPLE_CODES } from './ga-sample-allowlist.mjs';
const rows = [...GA_PROTECTED_PROJECTS.map(row => ({ ...row, status: 'active' })), ...APPROVED_SAMPLE_CODES.map((code,i) => ({ id: 10000+i, code, name: 'SYNTHETIC', status: 'archived' }))];
function client(mode = 'on', fail = false) {
  const statements = [];
  return { statements, query: async sql => {
    statements.push(sql);
    if (sql.startsWith('SHOW')) return { rows: [{ transaction_read_only: mode }] };
    if (sql.includes('current_database')) return { rows: [{ database_name: 'synthetic_fixture', captured_at: '2026-10-14T00:00:00Z' }] };
    if (sql.startsWith('SELECT id')) { if (fail) throw new Error('synthetic query failure'); return { rows }; }
    return { rows: [] };
  } };
}
const ok = client(); const result = await readAuthoritativeRoster(ok);
assert.equal(result.reconciliation.identityReconciled, true);
assert.match(ok.statements[0], /REPEATABLE READ READ ONLY/);
assert.equal(ok.statements.at(-1), 'ROLLBACK');
for (const item of [client('off'), client('on', true)]) {
  await assert.rejects(readAuthoritativeRoster(item));
  assert.equal(item.statements.at(-1), 'ROLLBACK');
}
assert.ok(ok.statements.every(sql => !/\b(INSERT|UPDATE|DELETE|COMMIT|ALTER|DROP)\b/.test(sql)));
console.log('PASS read-only roster transaction protocol; synthetic client, production connection not exercised');
