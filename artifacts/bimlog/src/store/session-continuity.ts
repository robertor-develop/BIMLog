export interface SessionSnapshot<User> {
  token: string | null;
  user: User | null;
  changedAt: number;
}

type TokenClaims = { exp?: number; iat?: number; sessionIssuedAt?: number };
export type SessionContinuityDiagnosticCode = "SESSION_TOKEN_CLAIMS_INVALID" | "SESSION_STORAGE_INVALID";
export type SessionContinuityReporter = (code: SessionContinuityDiagnosticCode) => void;

export function nextSessionChangedAt(previousChangedAt: number, now = Date.now()): number {
  return Math.max(now, Number.isFinite(previousChangedAt) ? previousChangedAt + 1 : now);
}

const reportSessionContinuityFailure: SessionContinuityReporter = (code) => {
  console.warn(`[BIMLogSessionContinuity] ${code}`);
};

function decodeClaims(token: string, reporter: SessionContinuityReporter = reportSessionContinuityFailure): TokenClaims | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as TokenClaims;
  } catch {
    reporter("SESSION_TOKEN_CLAIMS_INVALID");
    return null;
  }
}

export function sessionIssuedAt(token: string | null): number {
  if (!token) return 0;
  const claims = decodeClaims(token);
  if (Number.isFinite(claims?.sessionIssuedAt)) return Number(claims!.sessionIssuedAt);
  if (Number.isFinite(claims?.iat)) return Number(claims!.iat) * 1000;
  return 0;
}

export function isExpiredSession(token: string | null, now = Date.now()): boolean {
  if (!token) return false;
  const claims = decodeClaims(token);
  return !Number.isFinite(claims?.exp) || Number(claims!.exp) * 1000 <= now;
}

export function selectCurrentSession<User>(
  current: SessionSnapshot<User>,
  incoming: SessionSnapshot<User>,
  now = Date.now(),
): SessionSnapshot<User> {
  if (incoming.changedAt < current.changedAt) return current;
  if (incoming.token && isExpiredSession(incoming.token, now)) return current;
  if (incoming.token && sessionIssuedAt(incoming.token) < current.changedAt && !current.token)
    return current;
  if (incoming.token && current.token && sessionIssuedAt(incoming.token) < sessionIssuedAt(current.token))
    return current;
  return incoming;
}

export function readPersistedSession<User>(serialized: string | null, reporter: SessionContinuityReporter = reportSessionContinuityFailure): SessionSnapshot<User> | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as { state?: Partial<SessionSnapshot<User>> };
    const state = parsed.state;
    if (!state || typeof state.changedAt !== "number") return null;
    const token = typeof state.token === "string" ? state.token : null;
    const user = state.user ?? null;
    if ((token === null) !== (user === null)) return null;
    return { token, user, changedAt: state.changedAt };
  } catch {
    reporter("SESSION_STORAGE_INVALID");
    return null;
  }
}
