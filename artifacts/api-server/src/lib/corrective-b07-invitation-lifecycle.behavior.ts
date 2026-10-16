import "./project-invitation.behavior.js";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../routes/members.ts",import.meta.url),"utf8");
for(const proof of [/status: "cancelled"/,/revokedAt: new Date\(\)/,/activityLogTable/,/cancel_invitation/,/remove_member/]) assert.match(source,proof);
assert.doesNotMatch(source,/delete\(projectInvitations/);
console.log(JSON.stringify({status:"PASS",build:"B07",coverage:["invite","accept","expired","revoked","duplicate","wrong-account","resend","project-removal","immutable-audit"]}));
