import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/project-milestones-http.behavior.ts"], { stdio: "inherit", env: process.env, windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P184 actual milestone CRUD/import, validation, authorization, isolation, and audit-persistence gates passed; built schedule UI remains a separate gate.");
