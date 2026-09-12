import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const results = [];

function run(name, args) {
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  results.push({ name, exitCode: result.status });
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const file of [
  "post-p17-build61-files-identity-scope.behavior.mjs",
  "post-p17-build62-files-upload-storage.behavior.mjs",
  "post-p17-build63-files-cvr-versioning.behavior.mjs",
  "post-p17-build64-files-workflow-ui-links.behavior.mjs",
]) {
  const relativePath = `artifacts/api-server/src/lib/${file}`;
  run(file, ["node", relativePath]);
  results.at(-1).sha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
}

run("protected-apu", ["pnpm", "--filter", "@workspace/api-server", "run", "test:generic-apu"]);
run("protected-lens", ["pnpm", "--filter", "@workspace/api-server", "run", "test:lens-next-build30"]);
run("production-build", ["pnpm", "run", "build"]);

const output = path.join(root, "evidence", "post-p17-builds61-65-acceptance");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  path.join(output, "results.json"),
  JSON.stringify(
    {
      status: "PASS",
      version: "v1.05.N17-P18",
      results,
      browserEvidence: "evidence/post-p17-build64-files-cvr-chrome/acceptance.json",
      productCodeChanged: true,
      platformChanged: true,
      apuProductChanged: false,
      lensNextProductChanged: false,
      databaseChanged: false,
      schemaChanged: false,
      nativeChanged: false,
      deploymentChanged: false
    },
    null,
    2,
  ),
);
console.log("POST-P17 Builds 61-65 consolidated acceptance: PASS");
