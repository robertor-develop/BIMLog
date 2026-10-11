import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const source=readFileSync(fileURLToPath(new URL("./commercial-data-request-fulfillment.ts",import.meta.url)),"utf8");
for(const token of ["receiptReference","summary","decisionState","fulfilledAt"])assert.ok(source.includes(token),token);
assert.ok(source.includes('router.get("/support/cases/:id/data-request/fulfillment",authMiddleware'));assert.ok(source.includes("eq(supportCasesTable.companyId,actor.companyId),eq(supportCasesTable.requesterUserId,actor.userId)"));
assert.ok(source.includes('router.get("/admin/support/cases/:id/data-request/fulfillment",authMiddleware,isSuperAdminMiddleware'));assert.ok(!source.includes("fingerprint:supportCaseDataRequestFulfillmentsTable.fingerprint"));
console.log("LR094 tenant-safe fulfillment receipt projection: PASS");
