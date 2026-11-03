import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/project-members-authority-http.behavior.ts"], { stdio: "inherit", env: process.env, windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P183 actual project-member read, eligible, update, delete, authorization, isolation, and audit-persistence gates passed; PDF and built UI remain separate gates.");
