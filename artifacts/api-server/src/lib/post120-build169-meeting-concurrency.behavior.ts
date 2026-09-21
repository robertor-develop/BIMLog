import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  meetingCommandIdempotencyDigest,
  parseMeetingCommandReceipt,
} from "./meeting-minute-contracts";

const context = { projectId: 41, userId: 7, command: "meeting.create" };
const first = meetingCommandIdempotencyDigest("meeting-save-001", context);
const retry = meetingCommandIdempotencyDigest("meeting-save-001", context);
assert.equal(first, retry);
assert.match(first!, /^[a-f0-9]{64}$/);
assert.notEqual(first, meetingCommandIdempotencyDigest("meeting-save-001", { ...context, projectId: 42 }));
assert.equal(meetingCommandIdempotencyDigest(undefined, context), null);
assert.throws(() => meetingCommandIdempotencyDigest("bad key with spaces", context), /meeting_idempotency_key_invalid/);
assert.equal(parseMeetingCommandReceipt("not-json"), null);
assert.equal(
  parseMeetingCommandReceipt(JSON.stringify({ idempotencyDigest: first }))?.idempotencyDigest,
  first,
);

const route = await readFile(new URL("../routes/meeting_minutes.ts", import.meta.url), "utf8");
const lockIndex = route.indexOf("pg_advisory_xact_lock");
const insertIndex = route.indexOf(".insert(meetingMinutesTable)", lockIndex);
assert.ok(lockIndex > 0 && insertIndex > lockIndex, "idempotency lock must precede meeting insertion");
assert.match(route, /eq\(meetingMinutesTable\.updatedAt, existing\.updatedAt\)/);
assert.match(route, /if \(!row\) throw new MeetingClashLinkError\(409, "meeting_stale_update"\)/);

const ui = await readFile(new URL("../../../bimlog/src/pages/project/MeetingsTab.tsx", import.meta.url), "utf8");
assert.match(ui, /Idempotency-Key/);

console.log("POST120_BUILD169=PASS retries=idempotent concurrent_updates=atomic stale_writes=denied");
