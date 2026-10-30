import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const routes = readFileSync("artifacts/api-server/src/routes/edt-engine.ts", "utf8");
assert.match(routes, /requestResolvedEdtActivation\(/);
assert.match(routes, /approveResolvedEdtActivation\(/);
assert.match(routes, /ECONOMIC_PLAN_NOT_SERVER_RESOLVED/);
assert.match(routes, /TIME_AMOUNT_NOT_SERVER_RESOLVED/);
assert.doesNotMatch(routes, /nodes:\s*body\.nodes|workItems:\s*body\.workItems|actor:\s*body/,
  "authorized activation must still reject browser-authored authority and plans");
run("pnpm", ["run", "test:edt-engine-block13"]);
for (const build of [342, 343, 344, 345])
  run("pnpm", ["--filter", "@workspace/api-server", "run", `test:edt-engine-build${build}`]);
console.log("EDT_ENGINE_BLOCK14_RESULT=PASS exact candidate and server-owned intent/approval; P147 HTTP/UI acceptance is separate");
