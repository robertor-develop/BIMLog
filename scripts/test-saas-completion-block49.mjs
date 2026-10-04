import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),tsx=path.join(root,"artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for(const file of [
  "artifacts/api-server/src/lib/commercial-billing-history.behavior.ts",
  "artifacts/api-server/src/routes/commercial-billing-history-route.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-billing-history-client.behavior.ts",
  "artifacts/bimlog/src/components/commercial/billing-history-panel.behavior.ts",
])execFileSync(process.execPath,[tsx,path.join(root,file)],{stdio:"inherit"});
console.log("B241-B245 Block 49 customer billing history acceptance: PASS");
