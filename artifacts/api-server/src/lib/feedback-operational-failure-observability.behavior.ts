import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backup = readFileSync(new URL("./feedback-backup-worker.ts", import.meta.url), "utf8");
const telegram = readFileSync(new URL("./feedback-telegram-worker.ts", import.meta.url), "utf8");
const budgetImport = readFileSync(new URL("./financial-budget-import.ts", import.meta.url), "utf8");
assert.match(backup, /FEEDBACK_BACKUP_SETTLEMENT_ROLLBACK_FAILED/);
assert.doesNotMatch(backup, /query\("ROLLBACK"\)\.catch\(\(\) => undefined\)/);
assert.match(telegram, /FEEDBACK_TELEGRAM_SETTLEMENT_ROLLBACK_FAILED/);
assert.doesNotMatch(telegram, /try \{ await client\.query\("ROLLBACK"\); \} catch \{\}/);
assert.match(budgetImport, /FINANCIAL_BUDGET_IMPORT_ROLLBACK_FAILED/);
assert.doesNotMatch(budgetImport, /try\s*\{\s*await client\.query\("ROLLBACK"\);\s*\}\s*catch\s*\{\}/);

console.log("Feedback operational-failure observability Build 1: PASS");
