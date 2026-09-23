import { spawnSync } from "node:child_process";

for (const build of [331, 332, 333, 335]) {
  const result = spawnSync("pnpm", ["--filter", "@workspace/api-server", "run", `test:edt-engine-build${build}`], { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const ui = spawnSync("pnpm", ["--filter", "@workspace/bimlog", "run", "test:edt-engine-build334"], { stdio: "inherit", shell: process.platform === "win32" });
if (ui.status !== 0) process.exit(ui.status ?? 1);
console.log("EDT_ENGINE_BLOCK12_RESULT=PASS");
