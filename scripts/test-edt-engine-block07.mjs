import { spawnSync } from "node:child_process";

for (const build of [306, 307, 308, 309, 310]) {
  const result = spawnSync("pnpm", ["--filter", "@workspace/api-server", "run", `test:edt-engine-build${build}`], {
    stdio: "inherit", shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("EDT_ENGINE_BLOCK07_RESULT=PASS");
