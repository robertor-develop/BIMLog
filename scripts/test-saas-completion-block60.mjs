import {execFileSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const tsx=path.join(root,"artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for(const file of [
  "artifacts/api-server/src/lib/commercial-subscription-setup.behavior.ts",
  "artifacts/api-server/src/routes/commercial-workspace.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-workspace-client.behavior.ts",
  "artifacts/bimlog/src/lib/commercial-checkout-eligibility.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-workspace.behavior.ts",
])execFileSync(process.execPath,[tsx,path.join(root,file)],{stdio:"inherit"});
console.log("B296-B300 Block 60 prepared-offer checkout continuity: PASS");
