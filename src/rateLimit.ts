type BucketEntry = {
  timestamps: number[];
};

const buckets = new Map<string, BucketEntry>();
let lastPrune = Date.now();

function pruneOldEntries(now: number, maxWindowMs: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, entry] of buckets.entries()) {
    entry.timestamps = entry.timestamps.filter(ts => now - ts < maxWindowMs);
    if (entry.timestamps.length === 0) buckets.delete(key);
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}

export function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  pruneOldEntries(now, Math.max(windowMs, 10 * 60_000));

  const entry = buckets.get(bucketKey) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(bucketKey, entry);
    return { allowed: false, retryAfterSec };
  }

  entry.timestamps.push(now);
  buckets.set(bucketKey, entry);
  return { allowed: true };
}
