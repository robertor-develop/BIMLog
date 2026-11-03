import {spawnSync} from "node:child_process";
for(const test of ["artifacts/api-server/src/lib/meeting-draft-http.behavior.ts","artifacts/api-server/src/lib/post120-build169-meeting-concurrency.behavior.ts"]){
 const result=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",test],{stdio:"inherit",env:process.env,windowsHide:true});
 if(result.status!==0)process.exit(result.status??1);
}
console.log("P177 real draft persistence and connected concurrency checks passed; browser and live gates are separate.");
