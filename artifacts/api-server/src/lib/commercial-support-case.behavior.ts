import assert from "node:assert/strict";
import {parseSupportCaseInput,supportCaseFingerprint} from "./commercial-support-case";
const valid={category:"billing",priority:"normal",subject:"Invoice address",description:"Please help us correct the company invoice address.",requestKey:"support_request_0001"};
const parsed=parseSupportCaseInput(valid);assert.equal(parsed.subject,"Invoice address");assert.equal(supportCaseFingerprint(parsed),supportCaseFingerprint(parseSupportCaseInput({...valid})));
for(const bad of [{...valid,category:"sales"},{...valid,priority:"critical"},{...valid,subject:"x"},{...valid,description:"password=secret-value"},{...valid,requestKey:"short"}])assert.throws(()=>parseSupportCaseInput(bad));
console.log("B141 bounded secret-safe customer support case contract: PASS");
