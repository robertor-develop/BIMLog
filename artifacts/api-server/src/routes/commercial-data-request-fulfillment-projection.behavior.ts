import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const source=readFileSync(fileURLToPath(new URL("./commercial-data-request-fulfillment.ts",import.meta.url)),"utf8");
for(const token of ["receiptReference","summary","decisionState","fulfilledAt"])assert.ok(source.includes(token),token);
assert.ok(source.includes('"/support/cases/:id/data-request/fulfillment",authMiddleware'));assert.ok(source.includes("eq(supportCasesTable.companyId,actor.companyId),eq(supportCasesTable.requesterUserId,actor.userId)"));
assert.ok(source.includes('"/admin/support/cases/:id/data-request/fulfillment",authMiddleware,isSuperAdminMiddleware'));const projection=source.slice(source.indexOf("const receiptProjection="),source.indexOf('router.get("/support/cases/'));assert.ok(!projection.includes("fingerprint"));
console.log("LR094 tenant-safe fulfillment receipt projection: PASS");
