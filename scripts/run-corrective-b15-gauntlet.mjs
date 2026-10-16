import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const gates = [
  "test:corrective-b11",
  "test:corrective-b12",
  "test:corrective-b13",
  "test:corrective-b14",
  "test:ga-final-block02-build010",
  "test:ga-final-block03-build021",
  "test:ga-final-block03-build022",
  "test:ga-final-block04-build028",
  "test:ga-final-block05-build031",
  "test:ga-final-block05-build032",
  "test:ga-final-block05-build033",
];
const results=[];
for(const gate of gates){
  const result=process.platform==="win32"
    ? spawnSync(process.env.ComSpec||"cmd.exe",["/d","/s","/c",`pnpm ${gate}`],{encoding:"utf8"})
    : spawnSync("pnpm",[gate],{encoding:"utf8"});
  results.push({gate,status:result.status,stdout:(result.stdout||"").trim(),stderr:(result.stderr||result.error?.message||"").trim()});
  if(result.stdout) process.stdout.write(result.stdout);
  if(result.stderr) process.stderr.write(result.stderr);
}
assert.deepEqual(results.filter(item=>item.status!==0),[],JSON.stringify(results.filter(item=>item.status!==0),null,2));
console.log(`CORRECTIVE-B15 nonproduction lifecycle gauntlet: PASS gates=${gates.length}`);
