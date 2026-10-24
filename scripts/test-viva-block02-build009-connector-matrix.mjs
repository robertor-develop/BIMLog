import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const file of ["block18-build087-sharepoint-reference.behavior.ts", "block18-build088-outlook-custody.behavior.ts", "block18-build089-connector-matrix.behavior.ts"]) {
  const run = spawnSync(process.execPath, [tsx, `artifacts/api-server/src/lib/${file}`], { encoding: "utf8" });
  assert.equal(run.status, 0, `${file}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK02_BUILD009=PASS matrix=sharepoint,outlook,google_drive,dropbox,ifc_openbim,document_exchange secrets=REDACTED");
