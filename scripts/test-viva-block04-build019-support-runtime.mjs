import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const support = spawnSync("pnpm", ["run", "test:saas-block29"], { encoding: "utf8", shell: true, timeout: 120_000 });
assert.equal(support.status, 0, `${support.stdout ?? ""}\n${support.stderr ?? support.error ?? ""}`);
const sendgrid = spawnSync(process.execPath, ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/commercial-sendgrid-live-verification.behavior.ts"], { encoding: "utf8", timeout: 120_000 });
assert.equal(sendgrid.status, 0, `${sendgrid.stdout ?? ""}\n${sendgrid.stderr ?? sendgrid.error ?? ""}`);
console.log("VIVA_BLOCK04_BUILD019=PASS support_cases=true company_scope=true sendgrid_verification=true");
