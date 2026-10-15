import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { reconcileSampleAllowlist } from './ga-sample-allowlist.mjs';
import { GA_PROTECTED_PROJECTS } from '../artifacts/api-server/src/lib/ga-protected-projects.ts';

// Production reads are explicit. Never fall back to a development database.
export async function readAuthoritativeRoster(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '15s'");
    const mode = await client.query('SHOW transaction_read_only');
    if (mode.rows[0]?.transaction_read_only !== 'on') throw new Error('READ_ONLY_TRANSACTION_REQUIRED');
    const identity = await client.query('SELECT current_database() AS database_name, current_timestamp AS captured_at');
    const result = await client.query('SELECT id, code, name, status FROM projects ORDER BY id');
    const reconciliation = reconcileSampleAllowlist(result.rows, GA_PROTECTED_PROJECTS);
    await client.query('ROLLBACK');
    return { schema: 'bimlog.ga-authoritative-roster.v1', source: 'PROD_DATABASE_URL', ...identity.rows[0], projects: result.rows, reconciliation };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.PROD_DATABASE_URL) throw new Error('PROD_DATABASE_URL_REQUIRED_NO_FALLBACK');
  const require = createRequire(new URL('../lib/db/package.json', import.meta.url));
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.PROD_DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const report = await readAuthoritativeRoster(client);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!report.reconciliation.identityReconciled) process.exitCode = 1;
  } catch {
    process.stderr.write('GA_ROSTER_READ_FAILED: production connection or read-only roster verification failed. No mutation was requested.\n');
    process.exitCode = 1;
  } finally { await client.end(); }
}
