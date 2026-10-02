import assert from "node:assert/strict";import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,"../../../..");
const schema=fs.readFileSync(path.join(root,"lib/db/src/schema/contact-submissions.ts"),"utf8"),startup=fs.readFileSync(path.join(root,"artifacts/api-server/src/app.ts"),"utf8");
for(const token of ["nextActionType","next_action_type","nextActionDueAt","next_action_due_at","contact_submissions_next_action_pair_chk","contact_submissions_next_action_due_idx"])assert.match(schema,new RegExp(token));
for(const token of ["ADD COLUMN IF NOT EXISTS next_action_type","ADD COLUMN IF NOT EXISTS next_action_due_at","contact_submissions_next_action_due_idx"])assert.match(startup,new RegExp(token));
console.log("B132 additive scheduled sales action schema parity: PASS");
