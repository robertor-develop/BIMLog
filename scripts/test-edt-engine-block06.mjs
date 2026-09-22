import { spawnSync } from "node:child_process";

for (const build of [296, 297, 298, 299, 300, 301, 302, 303, 304, 305]) {
  const result = spawnSync("pnpm", ["--filter", "@workspace/api-server", "run", `test:edt-engine-build${build}`], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const graph = spawnSync("pnpm", ["run", "test:post120-block37"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (graph.status !== 0) process.exit(graph.status ?? 1);
console.log("EDT_ENGINE_BLOCK06_RESULT=PASS");
