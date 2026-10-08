import { RateLimitStore } from './rateLimitStore';

export class InMemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();

    // Evict expired entries on every write so the map never grows unbounded.
    for (const [k, v] of this.hits) {
      if (now >= v.resetAt) {
        this.hits.delete(k);
      }
    }

    // If we're still over the cap, evict the oldest entry (first inserted).
    while (this.hits.size >= this.maxEntries) {
      const oldestKey = this.hits.keys().next().value;
      if (oldestKey === undefined) break;
      this.hits.delete(oldestKey);
    }

    const entry = this.hits.get(key);

    if (!entry || now >= entry.resetAt) {
      const newEntry = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, newEntry);
      return { ...newEntry };
    }

    entry.count += 1;
    return { ...entry };
  }

  size(): number {
    return this.hits.size;
  }

  _reset(): void {
    this.hits.clear();
  }
}
