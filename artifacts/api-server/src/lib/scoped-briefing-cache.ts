export class ScopedBriefingCache<T> {
  readonly #entries = new Map<string, { value: T; expiresAt: number }>();
  readonly #inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs = 30_000,
    private readonly maxEntries = 250,
  ) {
    if (ttlMs <= 0 || maxEntries <= 0) throw new Error("BRIEFING_CACHE_CONFIGURATION_INVALID");
  }

  static scopeKey(userId: number, projectIds: readonly number[]): string {
    const scope = [...new Set(projectIds)].sort((left, right) => left - right).join(",");
    return `${userId}:${scope}`;
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async resolve(key: string, loader: () => Promise<T>, now = Date.now()): Promise<T> {
    const cached = this.get(key, now);
    if (cached !== undefined) return cached;
    const active = this.#inFlight.get(key);
    if (active) return active;
    const pending = loader().then((value) => {
      if (this.#entries.size >= this.maxEntries) {
        const oldest = this.#entries.keys().next().value as string | undefined;
        if (oldest) this.#entries.delete(oldest);
      }
      this.#entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
      return value;
    }).finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, pending);
    return pending;
  }
}
