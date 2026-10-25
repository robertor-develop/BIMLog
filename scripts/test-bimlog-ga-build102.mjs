import { spawnSync } from "node:child_process";

const gates = [
  "test:bimlog-ga-build97",
  "test:bimlog-ga-build98",
  "test:bimlog-ga-build99",
  "test:bimlog-ga-build100",
  "test:bimlog-ga-build101",
];
for (const gate of gates) {
  const startedAt = Date.now();
  console.log(`BIMLog GA Build 102: running ${gate}...`);
  const result = spawnSync("pnpm", ["run", gate], { stdio: "inherit", shell: true, timeout: 1_200_000 });
  console.log(`BIMLog GA Build 102: ${gate} completed in ${Math.ceil((Date.now() - startedAt) / 1000)}s`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("BIMLog GA Build 102: PASS continuous published-baseline regression through Build 101");
