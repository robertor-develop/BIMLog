import { spawnSync } from "node:child_process";

const builds = [91, 92, 93, 94, 95, 96];
for (const build of builds) {
  const result = spawnSync("pnpm", ["run", `test:bimlog-ga-build${build}`], {
    encoding: "utf8",
    shell: true,
    timeout: 900_000,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`BIMLog GA Build 97: PASS continuous Builds ${builds[0]}-${builds.at(-1)} regression`);
