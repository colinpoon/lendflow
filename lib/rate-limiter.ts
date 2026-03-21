/**
 * Redis-backed sliding-window rate limiter for API endpoints.
 *
 * Uses @upstash/ratelimit with a sliding window algorithm for accurate
 * cross-instance rate limiting on serverless deployments.
 *
 * Falls back to a permissive no-op when Upstash env vars are not configured
 * (local development without Redis).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface TierConfig {
  maxRequests: number;
  windowSeconds: number;
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  standard: { maxRequests: 5, windowSeconds: 600 },  // 5 per 10 min
  vision: { maxRequests: 3, windowSeconds: 600 },     // 3 per 10 min
};

/**
 * Lazily initialized Ratelimit instances per tier.
 * Created on first use to avoid import-time errors when env vars are missing.
 */
const limiters = new Map<string, Ratelimit>();

function getLimiter(tier: string): Ratelimit | null {
  if (limiters.has(tier)) return limiters.get(tier)!;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  const config = TIER_CONFIGS[tier];
  if (!config) return null;

  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowSeconds} s`),
    prefix: `@lendflow/ratelimit:${tier}`,
    ephemeralCache: new Map(),
  });

  limiters.set(tier, limiter);
  return limiter;
}

/**
 * Check whether the given user is within the rate limit.
 *
 * @param userId - Clerk userId used as the rate-limit key
 * @param tier - Rate limit tier: 'standard' (5/10min) or 'vision' (3/10min)
 * @returns `allowed` — true if the request should proceed;
 *          `retryAfterSeconds` — seconds until a slot opens (0 when allowed)
 */
export async function checkRateLimit(
  userId: string,
  tier: 'standard' | 'vision' = 'standard'
): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const limiter = getLimiter(tier);

  if (!limiter) {
    // No Redis configured — allow all requests (local dev)
    console.warn('⚠️ Rate limiter: Upstash Redis not configured, allowing request');
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const { success, reset } = await limiter.limit(userId);

  if (success) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterMs = reset - Date.now();
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil(Math.max(0, retryAfterMs) / 1000),
  };
}
