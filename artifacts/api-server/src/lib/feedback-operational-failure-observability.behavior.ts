import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backup = readFileSync(new URL("./feedback-backup-worker.ts", import.meta.url), "utf8");
assert.match(backup, /FEEDBACK_BACKUP_SETTLEMENT_ROLLBACK_FAILED/);
assert.equal((backup.match(/query\("ROLLBACK"\)\.catch\(\(\) => undefined\)/g) ?? []).length, 1);

console.log("Feedback operational-failure observability Build 1: PASS");
