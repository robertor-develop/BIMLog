import assert from "node:assert/strict";
import { mergeDailyObservations, recordDailySiteObservation } from "./daily-site-observation";

const manual = recordDailySiteObservation({ observationId: "WX-1", projectId: 8, dailyRecordId: "DR-8-1", kind: "weather", source: "manual", sourceLabel: "Field observation", providerRecordId: null, detail: "Light rain after 14:00", observedAt: "2026-09-28T18:00:00Z", recordedBy: "user-4" });
const delivery = recordDailySiteObservation({ observationId: "DEL-1", projectId: 8, dailyRecordId: "DR-8-1", kind: "delivery", source: "manual", sourceLabel: "Delivery ticket observation", providerRecordId: null, detail: "Duct delivery arrived incomplete", observedAt: "2026-09-28T18:05:00Z", recordedBy: "user-4" });
const outage = mergeDailyObservations({ projectId: 8, manual: [manual, delivery], provider: null });
assert.equal(outage.rows.length, 2, "provider outage does not lose manual weather, delivery or constraint notes");
assert.equal(outage.providerState, "unavailable");
assert.match(outage.providerNotice ?? "", /manual observations remain preserved/);
assert.throws(() => recordDailySiteObservation({ ...manual, observationId: "fake", source: "provider", sourceLabel: "Weather service" }), /provider record identity/);
assert.throws(() => recordDailySiteObservation({ ...manual, observationId: "bad", providerRecordId: "provider-1" }), /cannot claim a provider/);
console.log("C074 source-labeled manual and provider site observations: PASS");
