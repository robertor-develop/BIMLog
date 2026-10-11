import assert from "node:assert/strict";
import {parseSupportCaseInput,supportCaseFingerprint} from "./commercial-support-case";
const base={priority:"normal",subject:"Export my company data",description:"Please prepare the data held for my company.",requestKey:"support_0123456789abcdef"};
for(const dataRequestKind of ["export","correction","deletion","restriction"] as const){const parsed=parseSupportCaseInput({...base,category:"data",dataRequestKind});assert.equal(parsed.dataRequestKind,dataRequestKind);assert.equal(parsed.category,"data");}
assert.throws(()=>parseSupportCaseInput({...base,category:"data"}),/Data request type is required/);
assert.throws(()=>parseSupportCaseInput({...base,category:"account",dataRequestKind:"export"}),/only valid/);
const exportRequest=parseSupportCaseInput({...base,category:"data",dataRequestKind:"export"}),deletionRequest=parseSupportCaseInput({...base,category:"data",dataRequestKind:"deletion"});
assert.notEqual(supportCaseFingerprint(exportRequest),supportCaseFingerprint(deletionRequest));
console.log("LR081 bounded customer data-right request contract: PASS");
