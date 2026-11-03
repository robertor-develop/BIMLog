import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/meeting-transcribe-audio-http.behavior.ts"], { stdio: "inherit", env: process.env, windowsHide: true });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("P182 actual HTTP/router/PostgreSQL authorization and governed audio capability-state gates passed; no provider call was made.");
