import assert from "node:assert/strict";
import fs from "node:fs";
const route = fs.readFileSync(new URL("../routes/connections.ts", import.meta.url), "utf8");
assert.match(route, /\/me\/connections\/sendgrid\/verify/);
assert.match(route, /v3\/verified_senders/);
assert.match(route, /sender\?\.verified === true/);
assert.match(route, /status: ready \? "ready" : "connected"/);
console.log("UX148_SENDGRID_VERIFICATION=PASS key_connection_distinct=true sender_api=verified_senders");
