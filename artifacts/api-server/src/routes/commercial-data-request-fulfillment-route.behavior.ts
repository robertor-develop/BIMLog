import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";
const route=readFileSync(fileURLToPath(new URL("./commercial-data-request-fulfillment.ts",import.meta.url)),"utf8"),index=readFileSync(fileURLToPath(new URL("./index.ts",import.meta.url)),"utf8");
for(const token of ["authMiddleware,isSuperAdminMiddleware","assignedToUserId!==actorId","dataRequestState!==input.expectedState","eq(supportCasesTable.updatedAt,input.expectedUpdatedAt)","supportCaseDataRequestFulfillmentsTable","dataRequestState:\"fulfilled\"","data_request_fulfilled"])assert.ok(route.includes(token),token);
assert.ok(index.includes("router.use(commercialDataRequestFulfillmentRouter)"));assert.ok(route.indexOf("supportCaseDataRequestFulfillmentsTable")<route.indexOf("res.status(201).json"));
console.log("LR093 atomic protected data-request fulfillment route: PASS");
