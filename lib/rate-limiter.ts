/**
 * In-memory sliding-window rate limiter for API endpoints.
 * No external dependencies — timestamps are stored per userId in a module-level Map.
 *
 * Uses LRU eviction: delete-and-reinsert on every access keeps recently active
 * users at the end of Map iteration order, so eviction targets truly inactive users.
 *
 * Memory cap: 10,000 user entries (least-recently-used evicted when full).
 *
 * TODO: Replace with Redis-backed solution (e.g. @upstash/ratelimit) for production
 * multi-instance / serverless deployments where module-level state doesn't persist.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 10_000;

interface TierConfig {
  maxRequests: number;
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  standard: { maxRequests: 5 },
  vision: { maxRequests: 3 },
};

/**
 * Map from userId → sorted array of request timestamps (epoch ms).
 * Entries are ordered by most-recent access (LRU) via delete-and-reinsert.
 */
const requestLog = new Map<string, number[]>();

/**
 * Check whether the given user is within the rate limit.
 *
 * @param userId - Clerk userId used as the rate-limit key
 * @param tier - Rate limit tier: 'standard' (5/10min) or 'vision' (3/10min)
 * @returns `allowed` — true if the request should proceed;
 *          `retryAfterSeconds` — seconds until the oldest in-window request
 *          expires (0 when allowed)
 */
export function checkRateLimit(
  userId: string,
  tier: 'standard' | 'vision' = 'standard'
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const { maxRequests } = TIER_CONFIGS[tier];

  // Retrieve and prune timestamps that have fallen outside the window
  const timestamps = (requestLog.get(userId) ?? []).filter(
    (ts) => ts > windowStart
  );

  // LRU: delete and re-insert to move this user to the end of iteration order
  requestLog.delete(userId);

  if (timestamps.length >= maxRequests) {
    // Still update the entry position (user is active, just rate-limited)
    requestLog.set(userId, timestamps);
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

  // Evict the least-recently-used entry if the map has reached capacity
  if (requestLog.size >= MAX_ENTRIES) {
    const lruKey = requestLog.keys().next().value;
    if (lruKey !== undefined) {
      requestLog.delete(lruKey);
    }
  }

  requestLog.set(userId, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
