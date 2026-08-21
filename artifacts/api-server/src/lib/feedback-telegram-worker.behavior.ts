import assert from "node:assert/strict";
import fs from "node:fs";
import { aggregateFeedbackTelegramDelivery, feedbackTelegramConfigurationDecision } from "./feedback-telegram-policy";

assert.equal(feedbackTelegramConfigurationDecision(false,0),"provider-not-configured"); assert.equal(feedbackTelegramConfigurationDecision(true,0),"no-opted-in-reviewer"); assert.equal(feedbackTelegramConfigurationDecision(true,1),"ready");
const event=(id:number,snapshotEventId:number,recipientUserId:number|null,artifactKind:string,state:string)=>({id,snapshotEventId,recipientUserId,artifactKind,state});
assert.equal(aggregateFeedbackTelegramDelivery(10,[7],[event(1,10,7,"docx","failed"),event(2,10,7,"xlsx","sent")]).overallState,"failed");
assert.equal(aggregateFeedbackTelegramDelivery(10,[7],[event(2,10,7,"xlsx","sent"),event(1,10,7,"docx","failed")]).overallState,"failed");
assert.equal(aggregateFeedbackTelegramDelivery(10,[7,8],[event(1,10,7,"docx","sent"),event(2,10,7,"xlsx","sent"),event(3,10,8,"docx","sent")]).overallState,"partial");
assert.equal(aggregateFeedbackTelegramDelivery(10,[7,8],[event(1,10,7,"docx","sent"),event(2,10,7,"xlsx","sent"),event(3,10,8,"docx","sent"),event(4,10,8,"xlsx","sent")]).overallState,"sent");
assert.equal(aggregateFeedbackTelegramDelivery(11,[7],[event(9,10,7,"docx","sent"),event(10,10,7,"xlsx","sent")]).overallState,"not-requested");
assert.equal(aggregateFeedbackTelegramDelivery(10,[7],[event(1,10,7,"docx","failed"),event(9,10,7,"docx","sent"),event(2,10,7,"xlsx","sent")]).overallState,"sent");
assert.equal(aggregateFeedbackTelegramDelivery(10,[],[event(1,10,null,"docx","skipped"),event(2,10,null,"xlsx","skipped")]).overallState,"skipped");
const worker = fs.readFileSync(new URL("./feedback-telegram-worker.ts", import.meta.url), "utf8"), telegram = fs.readFileSync(new URL("./telegram-product.ts", import.meta.url), "utf8"), app = fs.readFileSync(new URL("../app.ts", import.meta.url), "utf8"),route=fs.readFileSync(new URL("../routes/feedback.ts",import.meta.url),"utf8");
assert.match(worker,/state: "skipped"/); assert.match(worker,/provider-not-configured/); assert.match(worker,/no-opted-in-reviewer/); assert.match(worker,/notification_channels.*provider='telegram'.*status='connected'.*u\.is_super_admin=true/s); assert.match(worker,/state: "sending"[\s\S]*sendVerifiedTelegramDocument/); assert.match(worker,/"sent" \| "failed"/); assert.match(worker,/downloadBounded.*byteLength !== byteCount.*createHash\("sha256"\)/s); assert.match(worker,/providerAcknowledgementId.*Telegram acknowledged feedback document/s); assert.match(telegram,/sendVerifiedTelegramDocument[\s\S]*encrypted_telegram_chat_id[\s\S]*decryptEvidence/); assert.match(telegram,/new FormData\(\)[\s\S]*new Blob[\s\S]*sendDocument/); assert.match(telegram,/BIMLOG_FEEDBACK_TELEGRAM_MAX_BYTES[\s\S]*BIMLOG_FEEDBACK_TELEGRAM_TIMEOUT_MS/); assert.match(app,/if \(telegramWorkersReady\)[\s\S]*startFeedbackTelegramDeliveryWorker\(\)/);
assert.match(route,/pkg\.id package_snapshot_event_id/);assert.match(route,/jsonb_agg\(jsonb_build_object/);assert.match(route,/telegramDelivery:telegram/);assert.match(route,/aggregateFeedbackTelegramDelivery/);
console.log("feedback Telegram governed delivery and aggregation: 26/26 passed");
