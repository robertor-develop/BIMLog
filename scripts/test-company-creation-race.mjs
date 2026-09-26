import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../artifacts/api-server/package.json',import.meta.url));
const {Client}=require('pg');
const options={host:'127.0.0.1',port:55469,user:'postgres',database:'postgres',connectionTimeoutMillis:3000};
const a=new Client(options),b=new Client(options);
const schema='identity_test_'+randomUUID().replaceAll('-','');
await a.connect();await b.connect();
try {
  await a.query(`CREATE SCHEMA ${schema}`);
  await a.query(`SET search_path TO ${schema}`);
  await b.query(`SET search_path TO ${schema}`);
  await a.query('CREATE TABLE companies(id serial PRIMARY KEY,name text NOT NULL)');
  await a.query(await readFile(new URL('../lib/db/scripts/company-identity-lifecycle.sql',import.meta.url),'utf8'));
  await a.query('BEGIN');await b.query('BEGIN');
  await b.query("SET LOCAL statement_timeout='5s'");
  await a.query("INSERT INTO companies(name) VALUES('TEST Concurrent Owner')");
  const competing=b.query("INSERT INTO companies(name) VALUES('test concurrent owner.')").then(()=>({code:'UNEXPECTED_SUCCESS'}),error=>({code:error.code}));
  await a.query('COMMIT');
  assert.equal((await competing).code,'23505');
  await b.query('ROLLBACK');
  assert.equal((await a.query('SELECT count(*)::int n FROM companies')).rows[0].n,1);
  await a.query("INSERT INTO companies(name) VALUES('Distinct new customer')");
  assert.equal((await a.query('SELECT count(*)::int n FROM companies')).rows[0].n,2);
  console.log('I004 PostgreSQL: concurrent punctuation duplicate rejected, distinct new owner allowed PASS');
} finally {
  await a.query('ROLLBACK');await b.query('ROLLBACK');
  // Only this randomly named disposable fixture schema on fixed loopback port.
  await a.query(`DROP SCHEMA ${schema} CASCADE`);
  await a.end();await b.end();
}
