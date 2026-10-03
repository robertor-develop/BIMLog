import assert from "node:assert/strict";import {parseSupportCaseMessage,supportCaseMessageFingerprint} from "./support-case-message";
const parsed=parseSupportCaseMessage({body:"  Please help with this model.  ",requestKey:"supportmessage_123456789"});assert.equal(parsed.body,"Please help with this model.");assert.equal(supportCaseMessageFingerprint(parsed),supportCaseMessageFingerprint(parsed));
for(const body of ["","x".repeat(4001),"password=customer-secret","Bearer abcdefghijklmnop"]){assert.throws(()=>parseSupportCaseMessage({body,requestKey:"supportmessage_123456789"}));}
assert.throws(()=>parseSupportCaseMessage({body:"valid message",requestKey:"short"}));console.log("B161 bounded secret-safe support message contract: PASS");
