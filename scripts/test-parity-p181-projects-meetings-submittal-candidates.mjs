import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/meeting-submittal-candidates-http.behavior.ts"],
  { stdio: "inherit", env: process.env, windowsHide: true },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P181 actual HTTP/router/PostgreSQL selector, authorization, isolation, persistence, and privacy gates passed; built UI remains a separate gate.");
