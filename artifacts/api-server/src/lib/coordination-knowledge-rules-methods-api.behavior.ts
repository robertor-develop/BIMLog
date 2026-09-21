import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CoordinationKnowledgeRepository, CoordinationKnowledgeRepositoryError, type KnowledgeQueryClient, type KnowledgeRepositoryPool } from "./coordination-knowledge-repository";

const calls: Array<{sql:string;params?:unknown[]}> = [];
const pool: KnowledgeRepositoryPool = {
  async query(){ return {rows:[]}; },
  async connect(){
    const client: KnowledgeQueryClient & {release():void} = {
      release(){},
      async query(sql,params){
        calls.push({sql,params});
        if(sql.includes("FROM coordination_rule_revisions") && sql.includes("FOR UPDATE")) return {rows:[{id:"00000000-0000-4000-8000-000000000010",rule_id:"00000000-0000-4000-8000-000000000011",company_id:42,revision:2,status:"under_review",title:"Maintain clearance",guidance:"Keep required service clearance.",applicability:{discipline:"HVAC"},rationale:"Maintainability",exceptions:[],references:[]}]};
        if(sql.includes("INSERT INTO coordination_rule_revisions")) return {rows:[{id:params?.[0],status:params?.[4],approved_by_id:params?.[12]}]};
        return {rows:[]};
      },
    };
    return client;
  },
};
const repository=new CoordinationKnowledgeRepository(pool);
const approved=await repository.appendRuleRevision({companyId:42,ruleId:"00000000-0000-4000-8000-000000000011",expectedRevision:2,actorId:77,action:"approve"});
assert.equal(approved.status,"approved");
assert.equal(approved.approved_by_id,77,"approval identity must come from authenticated actor");
assert.ok(calls.some(call=>call.sql.includes("coordination_knowledge_events") && call.params?.[5]===77),"rule approval must append immutable audit identity");

const deniedCalls:Array<{sql:string;params?:unknown[]}>=[];
const denied:KnowledgeRepositoryPool={async query(){return {rows:[]};},async connect(){return {release(){},async query(sql,params){deniedCalls.push({sql,params});if(sql.includes("FROM coordination_resolution_method_revisions")&&sql.includes("FOR UPDATE"))return {rows:[{id:"00000000-0000-4000-8000-000000000020",resolution_method_id:"00000000-0000-4000-8000-000000000021",company_id:42,revision:1,status:"draft",name:"Offset duct",description:"Offset around structure.",applicability:{},responsible_trade:"HVAC",constraints:[],advantages:[],disadvantages:[],required_approvals:[],rfi_requirement:"conditional",details:{}}]};if(sql.includes("coordination_resolution_method_conflict_types")&&sql.startsWith("SELECT"))return {rows:[{conflict_type_id:"00000000-0000-4000-8000-000000000099"}]};return {rows:[]};}};}};
await assert.rejects(new CoordinationKnowledgeRepository(denied).appendResolutionMethodRevision({companyId:42,resolutionMethodId:"00000000-0000-4000-8000-000000000021",expectedRevision:1,actorId:77,action:"update_draft",content:{name:"Offset duct",description:"Offset around structure.",applicability:{},responsibleTrade:"HVAC",constraints:[],advantages:[],disadvantages:[],requiredApprovals:[],rfiRequirement:"conditional",details:{},conflictTypeIds:["00000000-0000-4000-8000-000000000099"],ruleRevisionIds:[]}}),(error:unknown)=>error instanceof CoordinationKnowledgeRepositoryError&&error.code==="KNOWLEDGE_CROSS_TENANT_REFERENCE");
assert.ok(deniedCalls.some(call=>call.sql==="ROLLBACK"),"invalid method relationships must roll back atomically");

const source=readFileSync(fileURLToPath(new URL("../routes/coordination-knowledge.ts",import.meta.url)),"utf8");
for(const path of ["/coordination-knowledge/rules","/coordination-knowledge/resolution-methods","submit_for_review","history","retire"]) assert.match(source,new RegExp(path.replaceAll("/","\\/")));
assert.doesNotMatch(source,/req\.body\?\.approvedBy|req\.body\?\.retiredBy/,"clients must not control approval or retirement identity");
console.log("Coordination Knowledge Build 233 Rules and Resolution Methods APIs: lifecycle, relationships, history and server-owned decisions passed");
