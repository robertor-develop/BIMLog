import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), "utf8").replace(/\r\n/g, "\n");
const packageJson = JSON.parse(read("package.json"));
const workspace = read("pnpm-workspace.yaml");
const lockfile = read("pnpm-lock.yaml");
const npmrc = read(".npmrc");

assert.equal(packageJson.packageManager, "pnpm@11.17.0", "package manager identity must be exact");
assert.match(packageJson.scripts?.preinstall ?? "", /rm -f package-lock\.json yarn\.lock/);
assert.match(packageJson.scripts?.preinstall ?? "", /npm_config_user_agent/);
assert.equal(existsSync(path.join(root, "package-lock.json")), false, "package-lock.json is forbidden");
assert.equal(existsSync(path.join(root, "yarn.lock")), false, "yarn.lock is forbidden");
assert.match(npmrc, /^auto-install-peers=false$/m);
assert.match(lockfile, /^lockfileVersion: '9\.0'$/m);
assert.match(lockfile, /^\s*autoInstallPeers: false$/m);

const minimumReleaseAge = Number(workspace.match(/^minimumReleaseAge:\s*(\d+)$/m)?.[1]);
assert.ok(Number.isSafeInteger(minimumReleaseAge) && minimumReleaseAge >= 1440, "minimum release age must be at least one day");

for (const exactLine of [
  "allowBuilds:\n  electron: true\n  esbuild: true",
  "onlyBuiltDependencies:\n  - '@swc/core'\n  - esbuild\n  - msw\n  - unrs-resolver",
]) {
  assert.ok(workspace.includes(exactLine), `missing exact install-script allowlist: ${exactLine.split("\n")[0]}`);
}

const patchedResolutions = [
  "adm-zip@0.6.1",
  "body-parser@2.3.0",
  "brace-expansion@1.1.18",
  "brace-expansion@2.1.4",
  "drizzle-orm@0.45.2",
  "form-data@4.0.6",
  "lodash@4.18.1",
  "multer@2.3.0",
  "nanoid@5.1.16",
  "path-to-regexp@8.4.0",
  "picomatch@2.3.2",
  "qs@6.16.0",
  "sharp@0.35.4",
  "tmp@0.2.7",
  "uuid@11.1.1",
];

for (const resolution of patchedResolutions) {
  const escaped = resolution.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(lockfile, new RegExp(`^  ${escaped}:\\n    resolution: \\{integrity: sha512-`, "m"), `${resolution} must be integrity-bound`);
}

const integrityCount = lockfile.match(/resolution: \{integrity: sha512-/g)?.length ?? 0;
assert.ok(integrityCount >= 500, `unexpectedly small integrity-bound closure: ${integrityCount}`);

console.log(JSON.stringify({
  status: "PASS",
  packageManager: packageJson.packageManager,
  lockfileVersion: "9.0",
  minimumReleaseAge,
  patchedResolutions: patchedResolutions.length,
  integrityBoundResolutions: integrityCount,
  forbiddenAlternateLocks: 0,
}));
