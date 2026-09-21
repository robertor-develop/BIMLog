import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CoordinationKnowledgeRepository, CoordinationKnowledgeRepositoryError, type KnowledgeRepositoryPool } from "./coordination-knowledge-repository";

let captured:{sql:string;params?:unknown[]}|undefined;
const pool:KnowledgeRepositoryPool={
  async query(sql,params){captured={sql,params};return{rows:[
    {entity_type:"conflict_type",entity_id:"a",revision_id:"ra",title:"A"},
    {entity_type:"resolution_method",entity_id:"b",revision_id:"rb",title:"B"},
    {entity_type:"resolution_method",entity_id:"c",revision_id:"rc",title:"C"},
  ]};},
  async connect(){throw new Error("not used");},
};
const result=await new CoordinationKnowledgeRepository(pool).searchKnowledge({companyId:42,includeDrafts:false,keyword:"duct",discipline:"HVAC",conflictTypeId:"conflict-1",element:"Duct",category:"physical",methodId:"method-1",projectId:28,status:"approved",tags:["priority"],page:2,pageSize:2});
assert.equal(result.items.length,2);assert.equal(result.hasMore,true);assert.equal(result.page,2);
assert.equal(captured?.params?.[0],42,"company scope must be the first mandatory SQL boundary");
assert.equal(captured?.params?.[1],false,"ordinary users must search approved knowledge only");
assert.equal(captured?.params?.[10],28);assert.equal(captured?.params?.[11],3);assert.equal(captured?.params?.[12],2);
assert.match(captured?.sql??"",/ORDER BY candidate\.entity_type,lower\(candidate\.title\),candidate\.entity_id,candidate\.revision_id/);
assert.match(captured?.sql??"",/project_case\.company_id=\$1 AND project_case\.project_id=\$11/);
await assert.rejects(new CoordinationKnowledgeRepository(pool).searchKnowledge({companyId:42,includeDrafts:true,page:1,pageSize:101}),error=>error instanceof CoordinationKnowledgeRepositoryError&&error.code==="KNOWLEDGE_PAGE_SIZE_INVALID");

const route=readFileSync(fileURLToPath(new URL("../routes/coordination-knowledge.ts",import.meta.url)),"utf8");
for(const filter of ["keyword","discipline","conflictTypeId","element","category","methodId","projectId","status","tags","page","pageSize"])assert.match(route,new RegExp(filter));
assert.match(route,/status!=="approved"&&!resolved\.capabilities\.has\("view_draft"\)/);
assert.match(route,/tags\.length>25/);assert.match(route,/pageSize[^\n]+100/);
assert.doesNotMatch(route,/req\.query\.companyId/,"company scope must never be client selectable");
console.log("Coordination Knowledge Build 235 search: tenant scope, permission-aware status, filters, stable pagination and bounded malformed queries passed");
