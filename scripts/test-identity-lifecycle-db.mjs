import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url));
const {Client} = require('pg');
// Dedicated task-owned loopback fixture. No environment or production fallback.
const client = new Client({host:'127.0.0.1',port:55469,user:'postgres',database:'postgres',connectionTimeoutMillis:3000});
await client.connect();
try {
  await client.query('CREATE TEMP TABLE companies(id integer PRIMARY KEY,name text NOT NULL)');
  const migration = await readFile(new URL('../lib/db/scripts/company-identity-lifecycle.sql',import.meta.url),'utf8');
  await client.query(migration);
  await client.query(migration);
  await client.query("INSERT INTO companies(id,name) VALUES(31,'TEST OWNER'),(35,'TEST ALIAS')");
  for (const name of ['test owner.', ' TEST OWNER ', 'ＴＥＳＴ ＯＷＮＥＲ', 'TEST-OWNER'])
    await assert.rejects(client.query('INSERT INTO companies(id,name) VALUES(99,$1)',[name]), e=>e.code==='23505');
  await assert.rejects(client.query("UPDATE companies SET name='test owner.' WHERE id=35"),e=>e.code==='23505');
  await assert.rejects(client.query('UPDATE companies SET retired_into_company_id=35,retired_at=now() WHERE id=35'), e=>e.code==='23514');
  await assert.rejects(client.query('UPDATE companies SET retired_into_company_id=31 WHERE id=35'), e=>e.code==='23514');
  await assert.rejects(client.query('UPDATE companies SET retired_into_company_id=999,retired_at=now() WHERE id=35'), e=>e.code==='23503');
  await client.query('BEGIN');
  await client.query('UPDATE companies SET retired_into_company_id=31,retired_at=now() WHERE id=35');
  assert.deepEqual((await client.query('SELECT id FROM companies WHERE retired_into_company_id IS NULL ORDER BY id')).rows,[{id:31}]);
  assert.equal((await client.query('SELECT count(*)::int n FROM companies')).rows[0].n,2);
  await client.query('ROLLBACK');
  assert.equal((await client.query('SELECT count(*)::int n FROM companies WHERE retired_into_company_id IS NULL')).rows[0].n,2);
  console.log('I002 PostgreSQL: additive migration, repeat, FK, paired state, self-alias denial, selection and rollback PASS');
} finally {await client.end();}
