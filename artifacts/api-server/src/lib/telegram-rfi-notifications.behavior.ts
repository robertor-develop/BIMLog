import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./telegram-rfi-notifications.ts", import.meta.url), "utf8");

assert.match(
  source,
  /EXISTS \(SELECT 1 FROM project_members pm WHERE pm\.project_id=r\.project_id AND pm\.user_id=\$1 AND pm\.status='active'\)/,
  "ordinary RFI notification access must remain membership scoped",
);
assert.match(
  source,
  /EXISTS \(SELECT 1 FROM users u WHERE u\.id=\$1 AND u\.is_super_admin=true\)/,
  "global super administrators accepted by the route guard must also be accepted by notification context",
);
assert.match(source, /WHERE r\.id=\$3 AND r\.project_id=\$2/, "RFI access must remain bound to both project and RFI identity");

console.log("RFI notification access parity: PASS");
