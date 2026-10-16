import { execFileSync } from "node:child_process";
execFileSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs","lib/api-zod/src/integration-state.behavior.ts"],{stdio:"inherit"});
