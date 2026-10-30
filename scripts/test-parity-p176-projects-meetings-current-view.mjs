import {spawnSync} from "node:child_process";
const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const test of ["artifacts/api-server/src/lib/meeting-current-view-http.behavior.ts","artifacts/api-server/src/lib/post120-build168-meeting-view-scope.behavior.ts"]){
 const result=spawnSync(process.execPath,[tsx,test],{stdio:"inherit",env:process.env,windowsHide:true});
 if(result.status!==0)process.exit(result.status??1);
}
console.log("P176 actual HTTP/native artifact and connected scope gates passed; built browser and live release gates are separate.");
