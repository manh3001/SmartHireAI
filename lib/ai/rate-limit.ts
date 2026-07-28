export function createRateLimiter(opts: { max: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number): boolean {
      const cutoff = now - opts.windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
