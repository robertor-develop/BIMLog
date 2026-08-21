import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("./feedback-telegram-worker.ts", import.meta.url), "utf8");
const telegram = fs.readFileSync(new URL("./telegram-product.ts", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.ts", import.meta.url), "utf8");
const checks: Array<[string, RegExp]> = [
  ["delivery selects only connected Telegram super-admin reviewers", /notification_channels.*provider='telegram'.*status='connected'.*u\.is_super_admin=true/s],
  ["delivery is tied to the immutable internal package snapshot", /package_snapshot_created.*visibility.*internal/s],
  ["Word and Excel are independently receipted", /artifactFields = \{[\s\S]*docx:[\s\S]*xlsx:/],
  ["delivery reserves durably before provider contact", /state: "sending"[\s\S]*sendVerifiedTelegramDocument/],
  ["ambiguous provider outcomes never auto-retry", /if \(prior\.rowCount\).*return false[\s\S]*"delivered" \| "failed" \| "unknown"/s],
  ["stored document byte count and SHA are verified", /downloadBounded.*byteLength !== byteCount.*createHash\("sha256"\)/s],
  ["provider acknowledgement is recorded", /providerAcknowledgementId.*Telegram acknowledged feedback document/s],
  ["document send uses linked encrypted private chat authority", /sendVerifiedTelegramDocument[\s\S]*encrypted_telegram_chat_id[\s\S]*decryptEvidence/],
  ["document send uses Telegram sendDocument without shell or temp files", /new FormData\(\)[\s\S]*new Blob[\s\S]*sendDocument/],
  ["document send has byte and timeout bounds", /BIMLOG_FEEDBACK_TELEGRAM_MAX_BYTES[\s\S]*BIMLOG_FEEDBACK_TELEGRAM_TIMEOUT_MS/],
  ["worker starts only with accepted Telegram workers", /if \(telegramWorkersReady\)[\s\S]*startFeedbackTelegramDeliveryWorker\(\)/],
];
for (const [name, pattern] of checks) assert.match(`${worker}\n${telegram}\n${app}`, pattern, name);
console.log(`Feedback Telegram document delivery assertions: ${checks.length}/${checks.length} passed`);
