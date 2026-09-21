import assert from "node:assert/strict";
import { isExpiredSession, nextSessionChangedAt, readPersistedSession, selectCurrentSession, sessionIssuedAt } from "./session-continuity";

const token = (issuedAt: number, expiresAt: number) => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sessionIssuedAt: issuedAt, exp: Math.floor(expiresAt / 1000) })}.fixture`;
};
const now = 2_000_000;
const older = token(1_000_000, now + 60_000);
const newer = token(1_500_000, now + 60_000);
const expired = token(1_900_000, now - 1);
const user = { id: 1 };

assert.equal(sessionIssuedAt(newer), 1_500_000);
assert.equal(isExpiredSession(expired, now), true);
assert.equal(isExpiredSession(newer, now), false);
assert.equal(selectCurrentSession({ token: newer, user, changedAt: 10 }, { token: older, user, changedAt: 11 }, now).token, newer);
assert.equal(selectCurrentSession({ token: newer, user, changedAt: 20 }, { token: expired, user, changedAt: 21 }, now).token, newer);
assert.equal(selectCurrentSession({ token: older, user, changedAt: 10 }, { token: newer, user, changedAt: 11 }, now).token, newer);
assert.equal(selectCurrentSession({ token: null, user: null, changedAt: 1_600_000 }, { token: older, user, changedAt: 1_700_000 }, now).token, null);
assert.equal(selectCurrentSession({ token: newer, user, changedAt: 10 }, { token: null, user: null, changedAt: 20 }, now).token, null);
assert.deepEqual(readPersistedSession(JSON.stringify({ state: { token: newer, user, changedAt: 30 } })), { token: newer, user, changedAt: 30 });
assert.equal(readPersistedSession(JSON.stringify({ state: { token: newer, user: null, changedAt: 30 } })), null);
assert.equal(readPersistedSession("not-json"), null);
assert.equal(nextSessionChangedAt(100, 100), 101);
assert.equal(nextSessionChangedAt(100, 200), 200);

const tabA = { token: newer, user, changedAt: nextSessionChangedAt(1_500_000, 1_500_000) };
const tabB = selectCurrentSession({ token: older, user, changedAt: 1_500_000 }, tabA, now);
assert.equal(tabB.token, newer, "a second tab accepts the monotonic newer session");
const staleOutOfOrderResponse = { token: older, user, changedAt: 1_500_002 };
assert.equal(selectCurrentSession(tabB, staleOutOfOrderResponse, now).token, newer, "an out-of-order older token cannot overwrite the current session");
const loggedOut = { token: null, user: null, changedAt: nextSessionChangedAt(tabB.changedAt, 1_500_001) };
assert.equal(selectCurrentSession(loggedOut, staleOutOfOrderResponse, now).token, null, "a stale response cannot restore a logged-out session");

const diagnostics: string[] = [];
assert.equal(readPersistedSession("still-not-json", code => diagnostics.push(code)), null);
assert.deepEqual(diagnostics, ["SESSION_STORAGE_INVALID"]);
assert.doesNotMatch(JSON.stringify(diagnostics), /still-not-json|token|user/i);

console.log("session continuity: 18/18 passed");
