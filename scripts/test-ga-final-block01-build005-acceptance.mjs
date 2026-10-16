import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyIndependentEvidence } from "./lib/independent-evidence-contract.mjs";

const receiptPath = "evidence/ga-final-20261015/BLOCK01_AGENT_ACCESS_ACCEPTANCE.json";
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
const result=verifyIndependentEvidence(receipt);
assert.equal(result.valid,false,"legacy hand-authored receipt must remain invalid until replaced by captured artifacts");
assert.ok(result.errors.includes("schema"));
console.log("GA-F01-B005 historical receipt INVALIDATED: it is metadata, not independent acceptance evidence");
