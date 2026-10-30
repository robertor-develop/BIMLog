import assert from 'node:assert/strict';
import express from 'express';
import {pool} from '@workspace/db';
import router from '../routes/financial-controls';
import {signToken} from '../middlewares/auth';
import {startFinancialControlMigration} from './financial-control-migration';
const target=new URL(process.env.PROD_DATABASE_URL??'http://invalid');
if(!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='55435'||target.pathname!=='/bimlog_financial_bootstrap_http')throw new Error('Refusing non-disposable bootstrap test database');
await pool.query(`CREATE TABLE companies(id integer PRIMARY KEY,name text NOT NULL,retired_into_company_id integer);CREATE TABLE users(id integer PRIMARY KEY,email text NOT NULL,full_name text NOT NULL,password_hash text NOT NULL,company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false);CREATE TABLE projects(id integer PRIMARY KEY,name text NOT NULL,status text NOT NULL DEFAULT 'active',created_by_id integer NOT NULL REFERENCES users(id));CREATE TABLE project_members(project_id integer,user_id integer,status text,role text);INSERT INTO companies(id,name) VALUES(1,'Fixture A'),(2,'Fixture B');INSERT INTO users VALUES(11,'super@example.test','Super','fixture',1,true),(12,'member@example.test','Member','fixture',1,false),(21,'other@example.test','Other','fixture',2,false);`);
await startFinancialControlMigration();
const app=express();app.use(express.json());app.use('/api/v1',router);const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No fixture server address');
const token=(id:number)=>signToken({userId:id,email:`${id}@example.test`,fullName:'Fixture',companyId:id===21?2:1,companyName:'Fixture',isSuperAdmin:id===11});
const request=async(actor:number,body:Record<string,unknown>)=>{const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/financial-controls/bootstrap`,{method:'POST',headers:{Authorization:`Bearer ${token(actor)}`,'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:response.status,body:await response.json() as {contextId:string;grantId:string;scope:{companyId:number;projectId:number|null;scopeType:string};code?:string}};};
const input={administratorUserId:12,baseCurrency:'USD',reportingCurrency:'USD',permittedCurrencies:['USD','EUR'],reason:'Initialize isolated financial controls'};
try{
  assert.equal((await request(12,input)).status,403);
  assert.equal((await request(11,{...input,reason:''})).status,400);
  assert.equal((await request(11,{...input,administratorUserId:21})).status,400);
  const created=await request(11,input);assert.equal(created.status,201,JSON.stringify(created.body));assert.match(created.body.contextId,/^[a-f0-9-]{36}$/);assert.match(created.body.grantId,/^[a-f0-9-]{36}$/);assert.deepEqual(created.body.scope,{companyId:1,projectId:null,scopeType:'company'});
  const journal=(await pool.query(`SELECT subject_user_id,evidence FROM financial_authority_journal WHERE event_type='bootstrap'`)).rows;assert.equal(journal.length,1);assert.equal(journal[0].subject_user_id,12);assert.equal(journal[0].evidence.contextId,created.body.contextId);assert.equal(journal[0].evidence.grantId,created.body.grantId);
  const repeated=await request(11,input);assert.equal(repeated.status,409);assert.equal(repeated.body.code,'FIN_BOOTSTRAP_ALREADY_COMPLETE');assert.equal((await pool.query('SELECT count(*)::int n FROM financial_context_versions')).rows[0].n,1);assert.equal((await pool.query('SELECT count(*)::int n FROM financial_authority_grants')).rows[0].n,1);
  console.log('Financial bootstrap HTTP: super-only, reason/target denial, exact scope/receipt, persisted journal and repeat conflict without duplicate state PASS');
}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();}
