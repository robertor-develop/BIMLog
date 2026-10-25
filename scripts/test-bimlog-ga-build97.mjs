import { spawnSync } from "node:child_process";

const builds = [91, 92, 93, 94, 95, 96];
for (const build of builds) {
  const startedAt = Date.now();
  console.log(`BIMLog GA Build 97: running Build ${build} regression...`);
  const result = spawnSync("pnpm", ["run", `test:bimlog-ga-build${build}`], {
    stdio: "inherit",
    shell: true,
    timeout: 900_000,
  });
  console.log(`BIMLog GA Build 97: Build ${build} completed in ${Math.ceil((Date.now() - startedAt) / 1000)}s`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`BIMLog GA Build 97: PASS continuous Builds ${builds[0]}-${builds.at(-1)} regression`);
