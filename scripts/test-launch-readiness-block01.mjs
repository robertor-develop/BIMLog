import {execFileSync} from "node:child_process";import path from "node:path";import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),tsx=path.join(root,"artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for(const file of ["artifacts/api-server/src/lib/commercial-launch-profile.behavior.ts","artifacts/api-server/src/lib/commercial-launch-dossier.behavior.ts","artifacts/api-server/src/routes/commercial-launch-dossier-route.behavior.ts","artifacts/bimlog/src/lib/commercial-launch-dossier-client.behavior.ts","artifacts/bimlog/src/components/admin/commercial-launch-dossier-panel.behavior.ts"])execFileSync(process.execPath,[tsx,path.join(root,file)],{stdio:"inherit"});
console.log("Launch Readiness Block 1 Builds 1-5: PASS");
