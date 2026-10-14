type Bucket = {
  count: number
  resetAt: number
}

export type RateLimiter = {
  allow: (key: string) => boolean
  stop: () => void
}

export function createRateLimiter(
  limit: number,
  windowMs: number,
  maxEntries = 5000,
  now: () => number = Date.now,
): RateLimiter {
  const buckets = new Map<string, Bucket>()
  const sweep = setInterval(() => {
    const current = now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(key)
    }
  }, windowMs)
  sweep.unref()
  return {
    allow(key: string): boolean {
      const current = now()
      const bucket = buckets.get(key)
      if (!bucket || bucket.resetAt <= current) {
        if (buckets.size >= maxEntries) {
          for (const [existing, entry] of buckets) {
            if (entry.resetAt <= current) buckets.delete(existing)
          }
          if (buckets.size >= maxEntries) {
            const oldest = buckets.keys().next().value as string | undefined
            if (oldest !== undefined) buckets.delete(oldest)
          }
        }
        buckets.set(key, { count: 1, resetAt: current + windowMs })
        return true
      }
      if (bucket.count >= limit) return false
      bucket.count += 1
      return true
    },
    stop(): void {
      clearInterval(sweep)
      buckets.clear()
    },
  }
}
