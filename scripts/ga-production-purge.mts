import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pool } from '../lib/db/src/index.ts';

const TARGETS = new Map([
  [27, 'ROB-T1'], [41, 'QA-P19-0914'], [42, 'QA-P21-E2E-0914'],
  [43, 'QA-P22-E2E-0914'], [44, 'QA-P23-E2E-0914'], [45, 'QA-P24-0915'],
  [46, 'QA-P25-0915'], [49, 'QA-LOR-0916'], [50, 'ROBERTOSNTEST'],
  [57, 'QA-AI-0924'], [58, 'QA-INT-B-0924'], [59, 'QA-C020-FUNDS'],
  [60, 'QA-C020-MATCH'], [63, 'PRJROB-T'],
]);
const PROTECTED = new Map([[23, 'IBQ-LIT'], [26, 'ELA01'], [35, 'PRO-521-TEST'], [64, 'QA-GAUNTLET-1014']]);
const q = (name: string) => `"${name.replaceAll('"', '""')}"`;
const stable = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Buffer.isBuffer(value)) return JSON.stringify(value.toString('base64'));
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value);
};
const sha = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
type Row = Record<string, unknown>;
type ForeignKey = { child: string; parent: string; childColumns: string[]; parentColumns: string[] };

async function metadata(client: any) {
  const pkRows = (await client.query(`
    SELECT c.relname AS table_name,array_agg(a.attname ORDER BY k.ord) AS columns
    FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL unnest(x.conkey) WITH ORDINALITY k(attnum,ord)
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
    WHERE x.contype='p' AND n.nspname='public' GROUP BY c.relname`)).rows;
  const pks = new Map<string, string[]>(pkRows.map((r: any) => [r.table_name, r.columns]));
  const foreignKeys = (await client.query(`
    SELECT cc.relname child,pc.relname parent,
      array_agg(ca.attname ORDER BY z.ord) child_columns,
      array_agg(pa.attname ORDER BY z.ord) parent_columns
    FROM pg_constraint x JOIN pg_class cc ON cc.oid=x.conrelid JOIN pg_namespace cn ON cn.oid=cc.relnamespace
    JOIN pg_class pc ON pc.oid=x.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
    CROSS JOIN LATERAL unnest(x.conkey,x.confkey) WITH ORDINALITY z(cattnum,pattnum,ord)
    JOIN pg_attribute ca ON ca.attrelid=cc.oid AND ca.attnum=z.cattnum
    JOIN pg_attribute pa ON pa.attrelid=pc.oid AND pa.attnum=z.pattnum
    WHERE x.contype='f' AND cn.nspname='public' AND pn.nspname='public'
    GROUP BY cc.relname,pc.relname`)).rows.map((r: any) => ({ child: r.child, parent: r.parent, childColumns: r.child_columns, parentColumns: r.parent_columns })) as ForeignKey[];
  const directTables = (await client.query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='project_id' ORDER BY table_name`)).rows.map((r: any) => r.table_name as string);
  return { pks, foreignKeys, directTables };
}

function keyFor(row: Row, columns: string[]) { return stable(columns.map(column => row[column])); }
async function selectChildren(client: any, fk: ForeignKey, parents: Row[]) {
  const values: unknown[] = [];
  const clauses = parents.map(parent => `(${fk.childColumns.map((column, index) => {
    values.push(parent[fk.parentColumns[index]]);
    return `${q(column)} IS NOT DISTINCT FROM $${values.length}`;
  }).join(' AND ')})`);
  if (!clauses.length) return [];
  return (await client.query(`SELECT * FROM ${q(fk.child)} WHERE ${clauses.join(' OR ')}`, values)).rows as Row[];
}

async function graphFromProjects(client: any, projectRows: Row[], pks: Map<string, string[]>, foreignKeys: ForeignKey[]) {
  const selected = new Map<string, Map<string, Row>>();
  selected.set('projects', new Map(projectRows.map(row => [keyFor(row, pks.get('projects') ?? ['id']), row])));
  let changed = true;
  while (changed) {
    changed = false;
    for (const fk of foreignKeys) {
      const parents = [...(selected.get(fk.parent)?.values() ?? [])];
      if (!parents.length) continue;
      const pk = pks.get(fk.child);
      if (!pk?.length) throw new Error(`RELEVANT_TABLE_WITHOUT_PRIMARY_KEY:${fk.child}`);
      const childRows = await selectChildren(client, fk, parents);
      if (!childRows.length) continue;
      const bucket = selected.get(fk.child) ?? new Map<string, Row>();
      for (const row of childRows) {
        const key = keyFor(row, pk);
        if (!bucket.has(key)) { bucket.set(key, row); changed = true; }
      }
      selected.set(fk.child, bucket);
    }
  }
  return selected;
}

function deletionOrder(selected: Map<string, Map<string, Row>>, foreignKeys: ForeignKey[]) {
  const tables = [...selected.keys()].filter(table => table !== 'projects');
  const remaining = new Set(tables); const order: string[] = [];
  while (remaining.size) {
    const leaf = [...remaining].find(table => !foreignKeys.some(fk => fk.parent === table && remaining.has(fk.child) && fk.child !== table));
    if (!leaf) throw new Error(`CYCLIC_DEPENDENCY:${[...remaining].sort().join(',')}`);
    order.push(leaf); remaining.delete(leaf);
  }
  return order;
}

async function deleteRows(client: any, table: string, rows: Row[], pk: string[]) {
  let deleted = 0;
  for (const row of rows) {
    const result = await client.query(`DELETE FROM ${q(table)} WHERE ${pk.map((column, index) => `${q(column)} IS NOT DISTINCT FROM $${index + 1}`).join(' AND ')}`, pk.map(column => row[column]));
    deleted += result.rowCount ?? 0;
  }
  if (deleted !== rows.length) throw new Error(`DELETE_COUNT_MISMATCH:${table}:${deleted}:${rows.length}`);
  return deleted;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const expectedHash = process.argv.find(arg => arg.startsWith('--manifest-sha='))?.split('=')[1];
  if (execute && !expectedHash) throw new Error('MANIFEST_SHA_REQUIRED');
  if (execute && process.argv.find(arg => arg.startsWith('--authorization='))?.split('=')[1] !== 'ROBERTOS_EXACT_SAMPLE_PURGE')
    throw new Error('EXACT_OPERATION_AUTHORIZATION_REQUIRED');
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query(`SET LOCAL lock_timeout='5s'`); await client.query(`SET LOCAL statement_timeout='120s'`);
    const allIds = [...TARGETS.keys(), ...PROTECTED.keys()];
    const roster = (await client.query(`SELECT * FROM projects WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE`, [allIds])).rows as Row[];
    if (roster.length !== allIds.length) throw new Error(`ROSTER_COUNT_MISMATCH:${roster.length}`);
    for (const [id, code] of [...TARGETS, ...PROTECTED]) if (roster.find(row => row.id === id)?.code !== code) throw new Error(`ROSTER_IDENTITY_MISMATCH:${id}:${code}`);
    const { pks, foreignKeys, directTables } = await metadata(client);
    const targetRows = roster.filter(row => TARGETS.has(row.id as number));
    const protectedRows = roster.filter(row => PROTECTED.has(row.id as number));
    const selected = await graphFromProjects(client, targetRows, pks, foreignKeys);
    const protectedGraph = await graphFromProjects(client, protectedRows, pks, foreignKeys);
    for (const table of directTables) {
      const result = await client.query(`SELECT count(*)::int n FROM ${q(table)} WHERE project_id=ANY($1::int[])`, [[...TARGETS.keys()]]);
      const expected = selected.get(table)?.size ?? 0;
      if (result.rows[0].n !== expected) throw new Error(`DIRECT_SCOPE_MISMATCH:${table}:${result.rows[0].n}:${expected}`);
    }
    const manifest = {
      schema: 'bimlog.ga-production-purge-manifest.v1', mode: 'exact_scope',
      targetProjects: targetRows.map(row => ({ id: row.id, code: row.code, name: row.name, status: row.status })),
      protectedProjects: protectedRows.map(row => ({ id: row.id, code: row.code, name: row.name, status: row.status })),
      tables: [...selected.entries()].filter(([table]) => table !== 'projects').sort(([a], [b]) => a.localeCompare(b)).map(([table, rows]) => ({ table, count: rows.size, primaryKeys: [...rows.values()].map(row => Object.fromEntries((pks.get(table) ?? []).map(column => [column, row[column]]))), exportSha256: sha([...rows.values()]) })),
      storageObjects: selected.get('files') ? [...selected.get('files')!.values()].map(row => ({ id: row.id, objectKey: row.storage_key ?? row.object_key ?? null })) : [],
    };
    const manifestSha256 = sha(manifest);
    if (execute && manifestSha256 !== expectedHash) throw new Error(`MANIFEST_CHANGED:${manifestSha256}`);
    const protectedDigest = sha([...protectedGraph.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([table, rows]) => [table, [...rows.values()]]));
    const order = deletionOrder(selected, foreignKeys);
    const receipts = [];
    for (const table of order) receipts.push({ table, count: await deleteRows(client, table, [...selected.get(table)!.values()], pks.get(table)!) });
    const projectDelete = await client.query(`DELETE FROM projects WHERE id=ANY($1::int[])`, [[...TARGETS.keys()]]);
    if (projectDelete.rowCount !== TARGETS.size) throw new Error(`PROJECT_DELETE_COUNT_MISMATCH:${projectDelete.rowCount}`);
    const protectedAfter = (await client.query(`SELECT * FROM projects WHERE id=ANY($1::int[]) ORDER BY id`, [[...PROTECTED.keys()]])).rows;
    if (protectedAfter.length !== PROTECTED.size) throw new Error('PROTECTED_PROJECT_CHANGED');
    const protectedGraphAfter = await graphFromProjects(client, protectedAfter, pks, foreignKeys);
    const protectedDigestAfter = sha([...protectedGraphAfter.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([table, rows]) => [table, [...rows.values()]]));
    if (protectedDigestAfter !== protectedDigest) throw new Error('PROTECTED_DEPENDENCIES_CHANGED');
    const remaining = await client.query(`SELECT id FROM projects WHERE id=ANY($1::int[])`, [[...TARGETS.keys()]]);
    if (remaining.rowCount) throw new Error('TARGET_PROJECT_REMAINS');
    if (!execute) {
      await client.query('ROLLBACK');
      const path = `tmp/ga-purge-dry-run-${manifestSha256}.json`;
      await writeFile(path, JSON.stringify({ ...manifest, manifestSha256, protectedDigest, receipts, transaction: 'rolled_back' }, null, 2));
      console.log(JSON.stringify({ result: 'DRY_RUN_PASS_ROLLED_BACK', manifestSha256, targetProjects: TARGETS.size, dependencyTables: manifest.tables.length, dependencyRows: manifest.tables.reduce((n, table) => n + table.count, 0), storageObjects: manifest.storageObjects.length, protectedProjects: PROTECTED.size, receiptPath: path }));
      return;
    }
    const actor = (await client.query(`SELECT id,email FROM users WHERE is_super_admin=true ORDER BY id LIMIT 1`)).rows[0];
    if (!actor) throw new Error('SUPER_ADMIN_AUDIT_ACTOR_REQUIRED');
    await client.query(`INSERT INTO admin_actions_log(admin_user_id,admin_email,action,target_type,target_id,details) VALUES($1,$2,'ga_authorized_sample_purge','project_roster',$3,$4::jsonb)`, [actor.id, actor.email, manifestSha256, JSON.stringify({ manifestSha256, targetProjects: [...TARGETS.entries()].map(([id, code]) => ({ id, code })), protectedProjects: [...PROTECTED.entries()].map(([id, code]) => ({ id, code })), protectedDigest, receipts })]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ result: 'PURGE_COMMITTED', manifestSha256, targetProjects: TARGETS.size, protectedProjects: PROTECTED.size, receipts }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); await pool.end(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
