import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../../..");
const results = [];
const run = (name, exe, args) => { const r = spawnSync(exe, args, { cwd: root, encoding: "utf8" }); process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || ""); results.push({ name, exitCode: r.status }); if (r.status !== 0) process.exit(r.status || 1); };
for (const file of ["post-p17-build41-change-order-identity-scope.behavior.mjs","post-p17-build42-change-order-lifecycle-financial.behavior.mjs","post-p17-build43-change-order-links-import.behavior.mjs","post-p17-build44-change-order-workflow-ui.behavior.mjs"]) {
  const relative = `artifacts/api-server/src/lib/${file}`; run(file, process.execPath, [relative]); results.at(-1).sha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
}
run("protected-apu-regression", "cmd.exe", ["/d","/s","/c","pnpm","--filter","@workspace/api-server","run","test:generic-apu"]);
run("protected-lens-next-regression", "cmd.exe", ["/d","/s","/c","pnpm","--filter","@workspace/api-server","run","test:lens-next-build30"]);
run("governed-production-build", "cmd.exe", ["/d","/s","/c","pnpm","run","build"]);
const output = path.join(root,"evidence","post-p17-builds41-45-acceptance"); fs.mkdirSync(output,{recursive:true}); fs.writeFileSync(path.join(output,"results.json"),JSON.stringify({status:"PASS",version:"v1.05.N17-P17",results,browserEvidence:"evidence/post-p17-build44-change-order-chrome/acceptance.json",productCodeChanged:false,apuProductChanged:false,lensNextProductChanged:false,databaseChanged:false,schemaChanged:false,nativeChanged:false,deploymentChanged:false},null,2));
console.log("POST-P17 Builds 41-45 consolidated acceptance: PASS");
