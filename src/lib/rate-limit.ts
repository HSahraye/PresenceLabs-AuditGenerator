type Entry = { count: number; resetAt: number };

const bucket = new Map<string, Entry>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = bucket.get(key);
  if (!current || current.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (current.count >= limit) {
    return { ok: false as const, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  bucket.set(key, current);
  return { ok: true as const, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
