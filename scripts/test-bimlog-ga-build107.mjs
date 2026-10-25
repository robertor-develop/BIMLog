import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

runTsGate("artifacts/api-server/src/lib/telegram-rfi-notifications.behavior.ts");
const source = fs.readFileSync("artifacts/api-server/src/lib/telegram-rfi-notifications.ts", "utf8");
assert.match(source, /u\.is_super_admin/);
assert.match(source, /pm\.status='active'/);
assert.match(source, /r\.id=\$3 AND r\.project_id=\$2/);
assert.match(source, /RFI_NOT_FOUND/);
console.log("BIMLog GA Build 107: PASS RFI notification access preserves super-admin parity and project isolation");
