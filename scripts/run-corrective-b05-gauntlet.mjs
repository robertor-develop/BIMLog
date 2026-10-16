import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const output=process.argv[2];if(!output)throw new Error("output path required");
const git=(...args)=>spawnSync("git",args,{encoding:"utf8"}).stdout.trim();
const commands=[
  ["B01 traceability","pnpm",["run","test:corrective-b01"]],
  ["B02 independent evidence","pnpm",["run","test:corrective-b02"]],
  ["B03 behavioral gates","pnpm",["run","test:corrective-b03"]],
  ["B04 identity contract","pnpm",["run","test:corrective-b04"]],
  ["frontend typecheck","pnpm",["--filter","@workspace/bimlog","run","typecheck"]],
  ["api typecheck","pnpm",["--filter","@workspace/api-server","run","typecheck"]],
  ["runtime import and retired-module closure","pnpm",["--filter","@workspace/api-server","run","test:deployment-module-recovery"]],
  ["route/index reconciliation","node",["scripts/test-launch-audit-index-reconciliation.mjs"]],
  ["frontend production build","pnpm",["--filter","@workspace/bimlog","run","build"]],
  ["api production build","pnpm",["--filter","@workspace/api-server","run","build"]],
  ["production artifact closure","pnpm",["--filter","@workspace/api-server","run","test:production-artifact"]]
];
const results=[];
for(const [name,command,args] of commands){
  const started=Date.now(),run=spawnSync(command,args,{encoding:"utf8",timeout:600000,maxBuffer:20*1024*1024,shell:process.platform==="win32"});
  const combined=`${run.stdout||""}${run.stderr||""}`;
  results.push({name,result:run.status===0?"PASS":"FAIL",exitCode:run.status,timedOut:Boolean(run.error?.code==="ETIMEDOUT"),durationMs:Date.now()-started,outputSha256:createHash("sha256").update(combined).digest("hex"),outputTail:combined.slice(-1600)});
  if(run.status!==0) break;
}
const dirty=git("status","--porcelain");
const ledger={schemaVersion:"bimlog-corrective-b1-gauntlet-v1",capturedAt:new Date().toISOString(),source:{head:git("rev-parse","HEAD"),tree:git("rev-parse","HEAD^{tree}"),clean:dirty==="",dirtyPaths:dirty?dirty.split(/\r?\n/):[]},checks:results,coverage:[
  {area:"local-build-typecheck-runtime-closure",result:results.every(x=>x.result==="PASS")?"PASS":"FAIL"},
  {area:"database-preview-migration-rollback",result:"UNTESTED"},
  {area:"authenticated-rendered-desktop-tablet-390",result:"UNTESTED"},
  {area:"live-provider-lifecycle",result:"UNTESTED"},
  {area:"deployment-exact-head",result:"UNTESTED"}
]};
ledger.overall=results.length===commands.length&&results.every(x=>x.result==="PASS")&&ledger.source.clean?"LOCAL_PASS_RELEASE_HOLD":"FAIL";
writeFileSync(output,JSON.stringify(ledger,null,2)+"\n");
console.log(JSON.stringify({output,overall:ledger.overall,head:ledger.source.head,clean:ledger.source.clean,checks:results.map(x=>[x.name,x.result])}));
if(ledger.overall==="FAIL")process.exit(1);
