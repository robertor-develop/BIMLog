import assert from "node:assert/strict";import {parseLastReadMessageId,supportConversationReadState} from "./support-conversation-read";
assert.equal(parseLastReadMessageId({lastReadMessageId:7}),7);for(const invalid of [{},null,{lastReadMessageId:0},{lastReadMessageId:"7"}])assert.throws(()=>parseLastReadMessageId(invalid));
assert.deepEqual(supportConversationReadState([1,2,3],1),{lastReadMessageId:1,unreadCount:2});assert.deepEqual(supportConversationReadState([2,3],null),{lastReadMessageId:null,unreadCount:2});
console.log("B166 governed support conversation read contract: PASS");
