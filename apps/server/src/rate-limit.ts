const PRUNE_ABOVE_KEYS = 1000;

/** Fixed-window limiter, in memory. Counts reset when the server restarts. */
export class RateLimiter {
  readonly #windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number,
  ) {}

  /** Records an attempt. Returns false if the key is over its limit. */
  allow(key: string): boolean {
    const now = this.now();
    if (this.#windows.size > PRUNE_ABOVE_KEYS) this.#prune(now);

    const window = this.#windows.get(key);
    if (!window || now >= window.resetAt) {
      this.#windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    window.count++;
    return window.count <= this.limit;
  }

  #prune(now: number): void {
    for (const [key, window] of this.#windows) {
      if (now >= window.resetAt) this.#windows.delete(key);
    }
  }
}
