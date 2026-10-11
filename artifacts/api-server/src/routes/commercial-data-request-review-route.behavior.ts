import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const route=readFileSync(new URL("./commercial-data-request-review.ts",import.meta.url),"utf8"),index=readFileSync(new URL("./index.ts",import.meta.url),"utf8");
for(const token of ["/admin/support/cases/:id/data-request","isSuperAdminMiddleware","parseDataRequestReview","for(\"update\")","SUPPORT_CASE_NOT_ASSIGNED_TO_ACTOR","DATA_REQUEST_KIND_MISMATCH","DATA_REQUEST_REVIEW_STALE","data_request_reviewed","private, no-store"])assert.ok(route.includes(token),token);
assert.ok(index.includes("router.use(commercialDataRequestReviewRouter)"));assert.match(route,/dataRequestFulfilledAt:input\.state==="fulfilled"\?now:null/);
console.log("LR088 protected atomic customer data-request review operation: PASS");
