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
const calls: Array<{ url: string; authorization: string | null }> = [];
const fetchImpl: typeof fetch = async (input, init) => {
  const url = String(input);
  const authorization = new Headers(init?.headers).get("Authorization");
  calls.push({ url, authorization });
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
console.log("PASS Lens Next strict bridge origin and one-time silent token renewal");
