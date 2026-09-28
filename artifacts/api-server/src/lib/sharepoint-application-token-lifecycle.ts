import { z } from "zod/v4";

const tokenResultSchema = z.object({ token: z.instanceof(Uint8Array).refine(value => value.byteLength >= 16 && value.byteLength <= 8_192), expiresAtMs: z.number().int().positive() }).strict();

export interface SharePointApplicationTokenIssuer {
  issue(input: { companyId: number; credentialId: string }): Promise<{ token: Uint8Array; expiresAtMs: number }>;
}

/** Keeps application tokens server-side, renews once under concurrency and never serves an expired lease. */
export class SharePointApplicationTokenLifecycle {
  private readonly cache = new Map<string, { token: Uint8Array; expiresAtMs: number }>();
  private readonly renewals = new Map<string, Promise<{ token: Uint8Array; expiresAtMs: number }>>();

  constructor(private readonly issuer: SharePointApplicationTokenIssuer, private readonly clock = () => Date.now(), private readonly renewalWindowMs = 60_000) {}

  async withToken<T>(input: { companyId: number; credentialId: string }, operation: (token: Uint8Array) => Promise<T>): Promise<T> {
    if (!Number.isSafeInteger(input.companyId) || input.companyId <= 0 || !input.credentialId.trim()) throw new Error("SHAREPOINT_APPLICATION_TOKEN_SCOPE_INVALID");
    const key = `${input.companyId}:${input.credentialId}`;
    let lease = this.cache.get(key);
    if (!lease || lease.expiresAtMs - this.clock() <= this.renewalWindowMs) lease = await this.renew(key, input);
    if (lease.expiresAtMs <= this.clock()) throw new Error("SHAREPOINT_APPLICATION_TOKEN_EXPIRED");
    const borrowed = Uint8Array.from(lease.token);
    try { return await operation(borrowed); }
    finally { borrowed.fill(0); }
  }

  disconnect(input: { companyId: number; credentialId: string }): void {
    const lease = this.cache.get(`${input.companyId}:${input.credentialId}`);
    lease?.token.fill(0);
    this.cache.delete(`${input.companyId}:${input.credentialId}`);
  }

  private async renew(key: string, input: { companyId: number; credentialId: string }) {
    let renewal = this.renewals.get(key);
    if (!renewal) {
      renewal = this.issuer.issue(input).then(raw => {
        const next = tokenResultSchema.parse(raw);
        if (next.expiresAtMs <= this.clock() + this.renewalWindowMs) { next.token.fill(0); throw new Error("SHAREPOINT_APPLICATION_TOKEN_LEASE_TOO_SHORT"); }
        const prior = this.cache.get(key); prior?.token.fill(0);
        const retained = { token: Uint8Array.from(next.token), expiresAtMs: next.expiresAtMs };
        next.token.fill(0); this.cache.set(key, retained); return retained;
      }).finally(() => this.renewals.delete(key));
      this.renewals.set(key, renewal);
    }
    return renewal;
  }
}
