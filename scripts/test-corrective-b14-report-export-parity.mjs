import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of ["artifacts/api-server/src/lib/professional-report-package.behavior.ts","artifacts/api-server/src/lib/professional-report-parity.behavior.ts"])
  execFileSync(process.execPath,[tsx,file],{stdio:"inherit"});
const rfis=readFileSync("artifacts/api-server/src/routes/rfis.ts","utf8");
for(const route of ["rfis/export-pdf","rfis/export-excel"]) assert.ok(rfis.includes(route),`missing ${route}`);
assert.ok((rfis.match(/parseRfiRegisterFilters\(req\.query/g)||[]).length>=2,"PDF and Excel must parse the same authoritative filters");
assert.ok((rfis.match(/filterRfisForRegister\(allRfis, filters, creatorNames\)/g)||[]).length>=2,"PDF and Excel must apply the same source filter");
for(const token of ["status","rfiType","search","ballInCourt","sentToCompany","dateField","dateFrom","dateTo","sort"]) assert.ok(rfis.includes(token),`filter parity missing ${token}`);
assert.match(rfis,/requireProjectMember\(\)/);
assert.match(rfis,/Content-Disposition/);
console.log("CORRECTIVE-B14 screen/PDF/Excel source, scope, status, date and filter parity: PASS");
