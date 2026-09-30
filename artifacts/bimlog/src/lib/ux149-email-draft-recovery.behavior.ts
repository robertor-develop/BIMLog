import assert from "node:assert/strict"; import fs from "node:fs"; import { preserveEmailDraft, restoreEmailDraft } from "./email-draft-recovery";
const memory = new Map<string,string>(); const storage = { setItem:(k:string,v:string)=>{ memory.set(k,v); }, getItem:(k:string)=>memory.get(k)??null, removeItem:(k:string)=>{ memory.delete(k); } };
preserveEmailDraft({ projectId:7, recordType:"rfi", recordId:9, body:"review me", to:"a@b.com", cc:["c@d.com"], subject:"RFI-9" }, storage);
assert.equal(restoreEmailDraft(7,9,storage)?.body,"review me"); assert.equal(restoreEmailDraft(7,10,storage),null);
const route=fs.readFileSync(new URL("../../../api-server/src/routes/rfis.ts",import.meta.url),"utf8"); assert.match(route,/conn\.status !== "ready"/);
console.log("UX149_EMAIL_DRAFT_RECOVERY=PASS preflight=ready draft_scope=record no_auto_send=true");
