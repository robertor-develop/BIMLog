import assert from "node:assert/strict";
import { effectiveNotificationSummary } from "./settings-experience";
const active = effectiveNotificationSummary({ enabled: true, paused: false, frequency: "daily_digest", telegramConnected: true, telegramEnabled: true, emailAvailable: false });
assert.equal(active.delivery, "daily digest");
assert.deepEqual(active.channels.map(item => item.state), ["Available", "Ready", "Unavailable"]);
assert.equal(effectiveNotificationSummary({ enabled: true, paused: true, frequency: "immediate", telegramConnected: false, telegramEnabled: false, emailAvailable: true }).delivery, "Paused");
assert.equal(effectiveNotificationSummary({ enabled: false, paused: false, frequency: "immediate", telegramConnected: false, telegramEnabled: false, emailAvailable: false }).delivery, "Off");
console.log("post120 Build 182 effective notifications: PASS");
