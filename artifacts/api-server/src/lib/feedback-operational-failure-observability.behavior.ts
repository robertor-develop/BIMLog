import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backup = readFileSync(new URL("./feedback-backup-worker.ts", import.meta.url), "utf8");
const telegram = readFileSync(new URL("./feedback-telegram-worker.ts", import.meta.url), "utf8");
assert.match(backup, /FEEDBACK_BACKUP_SETTLEMENT_ROLLBACK_FAILED/);
assert.doesNotMatch(backup, /query\("ROLLBACK"\)\.catch\(\(\) => undefined\)/);
assert.match(telegram, /FEEDBACK_TELEGRAM_SETTLEMENT_ROLLBACK_FAILED/);
assert.equal((telegram.match(/try \{ await client\.query\("ROLLBACK"\); \} catch \{\}/g) ?? []).length, 1);

console.log("Feedback operational-failure observability Build 1: PASS");
