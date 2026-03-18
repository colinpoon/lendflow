/**
 * In-memory sliding-window rate limiter for API endpoints.
 * No external dependencies — timestamps are stored per userId in a module-level Map.
 *
 * Limits: 5 extractions per user per 10-minute window.
 * Memory cap: 10,000 user entries (oldest evicted when full).
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5;
const MAX_ENTRIES = 10_000;

/**
 * Map from userId → sorted array of request timestamps (epoch ms).
 * Only timestamps within the current sliding window are retained.
 */
const requestLog = new Map<string, number[]>();

/**
 * Check whether the given user is within the rate limit.
 *
 * @param userId - Clerk userId used as the rate-limit key
 * @returns `allowed` — true if the request should proceed;
 *          `retryAfterSeconds` — seconds until the oldest in-window request
 *          expires (0 when allowed)
 */
export function checkRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Retrieve and prune timestamps that have fallen outside the window
  const timestamps = (requestLog.get(userId) ?? []).filter(
    (ts) => ts > windowStart
  );

  if (timestamps.length >= MAX_REQUESTS) {
    // Oldest in-window timestamp determines when a slot opens up
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  // Admit the request: record the timestamp
  timestamps.push(now);

  // Evict the oldest entry if the map has reached capacity
  if (!requestLog.has(userId) && requestLog.size >= MAX_ENTRIES) {
    const oldestKey = requestLog.keys().next().value;
    if (oldestKey !== undefined) {
      requestLog.delete(oldestKey);
    }
  }

  requestLog.set(userId, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
