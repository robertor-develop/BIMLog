import {spawnSync} from "node:child_process";
const result=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs","artifacts/api-server/src/lib/meeting-import-http.behavior.ts"],{stdio:"inherit",env:process.env,windowsHide:true});
if(result.status!==0)process.exit(result.status??1);
console.log("P178 actual HTTP/router/SDK/PostgreSQL with loopback-only AI fixture passed; built UI and live-provider acceptance are separate gates.");
