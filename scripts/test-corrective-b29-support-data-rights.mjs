import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/api-server/src/lib/commercial-support-case.behavior.ts",
  "artifacts/api-server/src/lib/commercial-data-request.behavior.ts",
  "artifacts/api-server/src/lib/commercial-data-request-review.behavior.ts",
  "artifacts/api-server/src/lib/commercial-data-request-fulfillment.behavior.ts",
  "artifacts/api-server/src/lib/commercial-data-export.behavior.ts",
  "artifacts/api-server/src/routes/commercial-data-export-route.behavior.ts",
  "artifacts/api-server/src/routes/commercial-data-export-response.behavior.ts",
]) execFileSync(process.execPath,[tsx,file],{stdio:"inherit"});
const routes=readFileSync("artifacts/api-server/src/routes/support-cases.ts","utf8");
for(const token of ["authMiddleware","companyId","requestKey","requesterUserId","supportCaseEventsTable","Cache-Control","private, no-store"]) assert.ok(routes.includes(token),token);
console.log("CORRECTIVE-B29 tenant-scoped support, complaints, data-request and verified-export lifecycle: PASS");
