import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),tsx=path.join(root,"artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for(const file of ["artifacts/api-server/src/lib/commercial-launch-authorization.behavior.ts","artifacts/api-server/src/lib/commercial-launch-verification-store.behavior.ts","artifacts/api-server/src/routes/commercial-launch-authorization-route.behavior.ts","artifacts/bimlog/src/lib/commercial-launch-authorization-client.behavior.ts","artifacts/bimlog/src/components/admin/commercial-launch-authorization-panel.behavior.ts"])execFileSync(process.execPath,[tsx,path.join(root,file)],{stdio:"inherit"});
console.log("B276-B280 Block 56 current commercial launch authorization: PASS");
