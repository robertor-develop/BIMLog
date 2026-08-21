import assert from "node:assert/strict";
import fs from "node:fs";
import { reviewerScanFailureProjection } from "./feedback-reviewer-projection";

const createdAt=new Date("2026-08-21T00:00:00Z"),projected=reviewerScanFailureProjection({id:8,eventType:"evidence_scan_failed",afterState:{assetId:3,state:"retry-required",errorCode:"FEEDBACK_SCAN_SOURCE_MISMATCH",secret:"do-not-project"},createdAt});
assert.deepEqual(projected,{eventId:8,assetId:3,state:"retry-required",errorCode:"FEEDBACK_SCAN_SOURCE_MISMATCH",reason:"Stored evidence did not match its recorded authority and remains quarantined.",retryable:true,createdAt}); assert.doesNotMatch(JSON.stringify(projected),/do-not-project/);
assert.equal(reviewerScanFailureProjection({id:9,eventType:"evidence_scan_clean",afterState:{assetId:3},createdAt}),null); assert.equal(reviewerScanFailureProjection({id:10,eventType:"evidence_scan_failed",afterState:{assetId:0,errorCode:"../../secret"},createdAt}),null);
const route=fs.readFileSync(new URL("../routes/feedback.ts",import.meta.url),"utf8"),pkg=fs.readFileSync(new URL("./feedback-package-source.ts",import.meta.url),"utf8");assert.match(route,/scanFailures/);assert.match(route,/evidence_scan_started[\s\S]*evidence_scan_failed[\s\S]*evidence_scan_clean[\s\S]*evidence_scan_rejected/);assert.match(pkg,/evidence_scan_started.*evidence_scan_failed/);assert.doesNotMatch(route,/CUSTOMER_EVENT_TYPES = new Set\([^\n]*evidence_scan_failed/);
console.log("feedback reviewer scan-failure projection: 8/8 passed");
