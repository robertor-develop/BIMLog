import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const artifactDir = dirname(scriptDir);
const viteCli = resolve(artifactDir, "node_modules", "vite", "bin", "vite.js");
const configuredHeap = process.env.BIMLOG_VITE_MAX_OLD_SPACE_MB ?? "768";
const inheritedNodeOptions = process.env.NODE_OPTIONS?.trim();
const heapOption = `--max-old-space-size=${configuredHeap}`;

const result = spawnSync(
  process.execPath,
  [viteCli, "build", "--config", resolve(artifactDir, "vite.config.ts")],
  {
    cwd: artifactDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NODE_OPTIONS: inheritedNodeOptions
        ? `${inheritedNodeOptions} ${heapOption}`
        : heapOption,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`BIMLog production bundle could not start: ${result.error.message}`);
  process.exit(1);
}

if (result.signal) {
  console.error(`BIMLog production bundle was terminated by signal ${result.signal}.`);
  process.exit(1);
}

process.exit(result.status ?? 1);
