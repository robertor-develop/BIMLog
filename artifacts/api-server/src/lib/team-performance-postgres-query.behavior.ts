import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../../../lib/db/package.json",import.meta.url));
const {Client}=require("pg");
const connectionString=process.env.BIMLOG_COORDINATION_KNOWLEDGE_TEST_DATABASE_URL;
assert.ok(connectionString,"An explicit isolated PostgreSQL fixture is required");
const target=new URL(connectionString);
assert.ok(["127.0.0.1","localhost"].includes(target.hostname)&&target.pathname==="/bimlog_rfi_test","Only the named loopback fixture is allowed");
const source=fs.readFileSync(new URL("./team-performance-service.ts",import.meta.url),"utf8");
const queries=[...source.matchAll(/client\.query\(`([\s\S]*?)`/g)].map(match=>match[1]);
assert.equal(queries.length,8,"Review query coverage if the service changes");
const client=new Client({connectionString});
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  for(const sql of queries){
    assert.match(sql,/^SELECT /);
    const count=Math.max(...[...sql.matchAll(/\$(\d+)/g)].map(match=>Number(match[1])));
    await client.query("EXPLAIN "+sql,count===3?[58,null,null]:count===2?[58,1]:[58]);
  }
  console.log(JSON.stringify({status:"PASS",queries:queries.length,realPostgres:true,readOnly:true,customerDataRead:false}));
} finally {await client.query("ROLLBACK");await client.end();}
