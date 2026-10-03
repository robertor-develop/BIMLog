import assert from "node:assert/strict";
import {parseCustomerSupportCaseAction} from "./support-case-operations";
const at="2026-10-03T12:00:00.000Z";
assert.equal(parseCustomerSupportCaseAction({action:"close",expectedUpdatedAt:at}).reason,null);
assert.equal(parseCustomerSupportCaseAction({action:"reopen",expectedUpdatedAt:at,reason:"The reported issue returned."}).reason,"The reported issue returned.");
assert.throws(()=>parseCustomerSupportCaseAction({action:"reopen",expectedUpdatedAt:at,reason:"too short"}));
assert.throws(()=>parseCustomerSupportCaseAction({action:"reopen",expectedUpdatedAt:at,reason:"api_key: must never be shared"}));
assert.throws(()=>parseCustomerSupportCaseAction({action:"close",expectedUpdatedAt:at,reason:"extra"}));
console.log("B191 governed customer support close/reopen intent: PASS");
