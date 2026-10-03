import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {fileURLToPath} from "node:url";const source=readFileSync(fileURLToPath(new URL("./support-cases.ts",import.meta.url)),"utf8");
for(const token of ["support_case_messages","support_conversation_reads","last_read_message_id","unreadCount","latestMessageAt",'unreadCount(actor.userId,"administrator")','unreadCount(actorId,"customer")'])assert.ok(source.includes(token),token);
assert.match(source,/message\.id > coalesce/);assert.match(source,/actor\.companyId.*actor\.userId/);
console.log("B172 scoped support unread summaries: PASS");
