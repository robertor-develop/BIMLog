import assert from "node:assert/strict";
import { prepareMeetingPack } from "./meeting-pack-preparation";

const hash = "a".repeat(64);
const sections = (["agenda", "minutes", "actions", "schedule", "next_meeting"] as const).map((kind, index) => ({ kind, sourceId: `${kind}-${index}`, sourceVersion: 1, sha256: hash }));
const actor = { tenantId: 31, projectIds: [26], permissions: ["meeting-pack:prepare"] };
const pack = prepareMeetingPack({ tenantId: 31, projectId: 26, meetingId: "M-50", sections, recipients: ["reviewer@example.test", "reviewer@example.test"] }, actor);
assert.equal(pack.state, "prepared");
assert.equal(pack.sendPerformed, false);
assert.equal(pack.recipients.length, 1);
assert.throws(() => prepareMeetingPack({ tenantId: 31, projectId: 26, meetingId: "M-50", sections: sections.slice(0, 4), recipients: [] }, actor), /CHAIN_INCOMPLETE/);
assert.throws(() => prepareMeetingPack({ tenantId: 31, projectId: 26, meetingId: "M-50", sections, recipients: [] }, { ...actor, permissions: [] }), /PREPARE_DENIED/);
console.log("C055 governed meeting pack preparation without sending: PASS");
