export const LENS_NEXT_BRIDGE_SESSION_SOURCE = "lens-next-native-host" as const;
const MAX_SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_KEYS = [
  "protocolVersion",
  "source",
  "token",
  "issuedAt",
  "expiresAt",
] as const;

export interface LensNextBridgeSessionInjection {
  protocolVersion: 1;
  source: typeof LENS_NEXT_BRIDGE_SESSION_SOURCE;
  token: string;
  issuedAt: string;
  expiresAt: string;
}

export interface LensNextBridgeSessionSnapshot {
  token: string;
  expiresAtEpochMs: number;
}

export interface LensNextBridgeSessionReceipt {
  accepted: true;
  source: typeof LENS_NEXT_BRIDGE_SESSION_SOURCE;
  expiresAt: string;
}

let currentSession: Readonly<LensNextBridgeSessionSnapshot> | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function clearTimer(): void {
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Lens Next bridge session injection must be an object");
  }
  return value as Record<string, unknown>;
}

export function injectLensNextBridgeSession(
  value: unknown,
  nowEpochMs = Date.now(),
): LensNextBridgeSessionReceipt {
  const input = objectRecord(value);
  const keys = Object.keys(input).sort();
  const expectedKeys = [...SESSION_KEYS].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(
      "Lens Next bridge session injection contains unknown or missing fields",
    );
  }
  if (
    input.protocolVersion !== 1 ||
    input.source !== LENS_NEXT_BRIDGE_SESSION_SOURCE
  ) {
    throw new Error("Lens Next bridge session source or protocol is invalid");
  }
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!/^[A-Za-z0-9._~-]{32,512}$/.test(token)) {
    throw new Error("Lens Next bridge session token format is invalid");
  }
  const issuedAt =
    typeof input.issuedAt === "string"
      ? Date.parse(input.issuedAt)
      : Number.NaN;
  const expiresAt =
    typeof input.expiresAt === "string"
      ? Date.parse(input.expiresAt)
      : Number.NaN;
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    throw new Error("Lens Next bridge session timestamps are invalid");
  }
  if (
    issuedAt > nowEpochMs + 30_000 ||
    issuedAt < nowEpochMs - MAX_SESSION_TTL_MS
  ) {
    throw new Error(
      "Lens Next bridge session issue time is outside the accepted window",
    );
  }
  if (
    expiresAt <= nowEpochMs ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAX_SESSION_TTL_MS
  ) {
    throw new Error("Lens Next bridge session expiry is invalid");
  }

  clearTimer();
  currentSession = Object.freeze({ token, expiresAtEpochMs: expiresAt });
  expiryTimer = setTimeout(
    () => {
      currentSession = null;
      expiryTimer = null;
      notify();
    },
    Math.max(0, expiresAt - nowEpochMs),
  );
  notify();
  return Object.freeze({
    accepted: true,
    source: LENS_NEXT_BRIDGE_SESSION_SOURCE,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

export function clearLensNextBridgeSession(): void {
  clearTimer();
  if (currentSession === null) return;
  currentSession = null;
  notify();
}

export function getLensNextBridgeSessionSnapshot(): Readonly<LensNextBridgeSessionSnapshot> | null {
  return currentSession;
}

export function subscribeLensNextBridgeSession(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
