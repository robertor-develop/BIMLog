import assert from "node:assert/strict";import {normalizeSupportConversationAwareness,unreadSupportMessageIds} from "./support-conversation-awareness";
const messages=[{id:1,authorRole:"customer" as const},{id:2,authorRole:"administrator" as const},{id:3,authorRole:"customer" as const},{id:4,authorRole:"administrator" as const}];
assert.deepEqual(unreadSupportMessageIds({actorRole:"customer",lastReadMessageId:2,messages}),[4]);
assert.deepEqual(unreadSupportMessageIds({actorRole:"administrator",lastReadMessageId:null,messages}),[1,3]);
assert.deepEqual(normalizeSupportConversationAwareness({unreadCount:"2",latestMessageAt:"2026-10-02T12:00:00Z"}),{unreadCount:2,latestMessageAt:"2026-10-02T12:00:00.000Z"});
for(const value of [{unreadCount:-1,latestMessageAt:null},{unreadCount:1.5,latestMessageAt:null},{unreadCount:1,latestMessageAt:null},{unreadCount:0,latestMessageAt:"bad"}])assert.throws(()=>normalizeSupportConversationAwareness(value));
console.log("B171 deterministic support conversation awareness: PASS");
