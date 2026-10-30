import assert from 'node:assert/strict';
import { CoordinationKnowledgeTaxonomyRepository } from './coordination-knowledge-taxonomy';
import type { KnowledgeRepositoryPool } from './coordination-knowledge-repository';

const calls: Array<{sql:string;params:unknown[]}> = [];
let current: Record<string,unknown> | null = { kind:'discipline', normalized_key:'hvac', revision:2, status:'active', code:'HVAC', label:'HVAC' };
const client = {
  async query(sql:string, params:unknown[] = []) {
    calls.push({sql,params});
    if (sql.startsWith('SELECT base.kind')) return {rows:current ? [current] : []};
    if (sql.startsWith('INSERT INTO coordination_knowledge_taxonomy_term_revisions')) return { rows: [{ term_id:params[1],company_id:params[2],revision:params[3],status:params[4] }] };
    return {rows:[]};
  },
  release() {},
};
const pool: KnowledgeRepositoryPool = { query:(sql,params)=>client.query(sql,params),connect:async()=>client };
const repository = new CoordinationKnowledgeTaxonomyRepository(pool);
await repository.list(41,'discipline',false);
assert.deepEqual(calls[0].params,[41,'discipline',false]);
calls.length=0;
await assert.rejects(repository.revise(41,7,'term-1',1,{code:'HVAC',label:'HVAC'}),{code:'KNOWLEDGE_VERSION_CONFLICT'});
assert.equal(calls.some(call=>call.sql.startsWith('INSERT')),false);
assert.equal(calls.at(-1)?.sql,'ROLLBACK');
calls.length=0;
const revised=await repository.revise(41,7,'term-1',2,{code:'HVAC',label:'Mechanical HVAC'});
assert.equal(revised.revision,3);
assert.equal(revised.status,'active');
assert.deepEqual(calls.find(call=>call.sql.startsWith('SELECT base.kind'))?.params,['term-1',41]);
assert.ok(calls.some(call=>call.sql.includes('coordination_knowledge_events')));
assert.equal(calls.at(-1)?.sql,'COMMIT');
calls.length=0;
const retired=await repository.revise(41,7,'term-1',2,{},true);
assert.equal(retired.status,'retired');
assert.equal(retired.revision,3);
current={...current,status:'retired'};
await assert.rejects(repository.revise(41,7,'term-1',2,{code:'HVAC',label:'HVAC'}),{code:'KNOWLEDGE_TAXONOMY_RETIRED'});
current=null;
await assert.rejects(repository.revise(42,8,'term-1',2,{}),{code:'KNOWLEDGE_TAXONOMY_NOT_FOUND'});
console.log('Taxonomy repository scope, stale-write rejection, revision, retirement and append-only evidence: PASS');
