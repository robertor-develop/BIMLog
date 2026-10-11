import assert from "node:assert/strict";
import {dataRequestReviewFingerprint,parseDataRequestReview} from "./commercial-data-request-review";
const start=parseDataRequestReview({kind:"export",expectedState:"requested",state:"under_review",expectedUpdatedAt:"2026-10-11T12:00:00Z",reason:"Identity and tenant scope verified."});
assert.equal(start.state,"under_review");
const approve=parseDataRequestReview({kind:"export",expectedState:"under_review",state:"approved",expectedUpdatedAt:"2026-10-11T12:05:00Z",reason:"The governed export can be prepared."});
assert.notEqual(dataRequestReviewFingerprint(start),dataRequestReviewFingerprint(approve));
assert.throws(()=>parseDataRequestReview({kind:"deletion",expectedState:"requested",state:"fulfilled",expectedUpdatedAt:"2026-10-11T12:00:00Z",reason:"Delete immediately without review."}),/INVALID/);
assert.throws(()=>parseDataRequestReview({kind:"export",expectedState:"under_review",state:"approved",expectedUpdatedAt:"2026-10-11T12:05:00Z",reason:"token=customer-secret"}),/INVALID/);
console.log("LR086 governed customer data-request review contract: PASS");
