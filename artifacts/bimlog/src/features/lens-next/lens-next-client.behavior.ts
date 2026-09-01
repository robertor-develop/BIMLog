import assert from "node:assert/strict";
import {
  createLensNextBridgeClient,
  lensNextBridgeOriginFromSearch,
  validateLensNextBridgeOrigin,
} from "./lens-next-client";

for (const malicious of [
  "http://localhost:8766",
  "https://127.0.0.1:8766",
  "http://127.0.0.1:8765",
  "http://127.0.0.1:8866",
  "http://127.0.0.1:8766/path",
  "http://user@127.0.0.1:8766",
]) {
  assert.throws(() => validateLensNextBridgeOrigin(malicious));
}
assert.equal(
  lensNextBridgeOriginFromSearch("?bridgeOrigin=http%3A%2F%2F127.0.0.1%3A8800"),
  "http://127.0.0.1:8800",
);

const oldToken = "a".repeat(32);
const newToken = "b".repeat(32);
const calls: Array<{ url: string; authorization: string | null; contentType: string | null }> = [];
const fetchImpl: typeof fetch = async (input, init) => {
  const url = String(input);
  const authorization = new Headers(init?.headers).get("Authorization");
  const contentType = new Headers(init?.headers).get("Content-Type");
  calls.push({ url, authorization, contentType });
  if (url.endsWith("/v1/session")) {
    return Response.json({
      success: true,
      code: "session",
      payload: {
        protocolVersion: 1,
        source: "lens-next-native-host",
        token: newToken,
        sessionId: "renewed-session",
        issuedAt: "2026-08-30T00:00:00Z",
        expiresAt: "2026-08-30T00:15:00Z",
      },
    });
  }
  if (authorization === `Bearer ${oldToken}`) {
    return Response.json({ success: false, code: "session_expired" }, { status: 401 });
  }
  return Response.json({
    success: true,
    code: "pong",
    payload: { protocolVersion: 1 },
  });
};

const client = createLensNextBridgeClient({
  sessionToken: oldToken,
  bridgeOrigin: "http://127.0.0.1:8800",
  fetchImpl,
});
assert.equal(await client.probe(), true);
assert.deepEqual(calls.map((call) => call.authorization), [
  `Bearer ${oldToken}`,
  null,
  `Bearer ${newToken}`,
]);
assert.equal(await client.probe(), true);
assert.equal(calls.at(-1)?.authorization, `Bearer ${newToken}`);
assert.equal(calls.at(-1)?.contentType, "application/json; charset=utf-8");

const applyRequestId = "apply-request-00000001";
const applyBodies: string[] = [];
let applyAttempts = 0;
const retryingApply = createLensNextBridgeClient({
  sessionToken: oldToken,
  bridgeOrigin: "http://127.0.0.1:8800",
  requestIdFactory: () => applyRequestId,
  fetchImpl: async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/session")) return Response.json({ success: true, code: "session", payload: { protocolVersion: 1, source: "lens-next-native-host", token: newToken, sessionId: "renewed-session", issuedAt: "2026-08-30T00:00:00Z", expiresAt: "2026-08-30T00:15:00Z" } });
    applyBodies.push(String(init?.body));
    applyAttempts++;
    if (applyAttempts === 1) return Response.json({ success: false, code: "session_expired" }, { status: 401 });
    return Response.json({ success: true, code: "working_view_applied", payload: { protocolVersion: 1, requestId: applyRequestId, identity: { projectId: 29, serverId: 7, viewpointId: "VP-7", lifecycleStatus: "active", revisionNumber: 1 }, result: { Applied: true } } });
  },
});
await retryingApply.applyPlatformWorkingView(
  { identity: { projectId: 29, serverId: 7, viewpointId: "VP-7", lifecycleStatus: "active", revisionNumber: 1 }, bimlogPhysicalId: "OT-007", navisworksGuid: null, visualStateDigest: "d".repeat(64) } as any,
  { sessionId: "session", projectId: 29, modelFingerprint: "c".repeat(64), modelBindingKey: "managed", displayName: "model.nwd", bindingSource: "managed-marker", managedViewpointCount: 0 },
  JSON.stringify({ schemaVersion: 1 }),
  "d".repeat(64),
);
assert.equal(applyBodies.length, 2);
assert.equal(applyBodies[0], applyBodies[1]);
assert.equal(JSON.parse(applyBodies[0]).requestId, applyRequestId);
assert.equal(JSON.parse(applyBodies[0]).idempotencyKey, applyRequestId);
assert.equal(JSON.parse(applyBodies[0]).fields.visualStateDigest, "d".repeat(64));

console.log("PASS Lens Next strict bridge origin, safe token renewal, and stable apply idempotency");
