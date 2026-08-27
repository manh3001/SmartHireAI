// lib/security/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { RATE_LIMITS, type RateScope } from "./rate-config";
import { rateKey } from "./rate-key";

// --- Backend in-memory (dev/test hoặc khi thiếu Upstash) ---
const memoryLimiters = new Map<RateScope, ReturnType<typeof createRateLimiter>>();
function memoryCheck(scope: RateScope, key: string, now: number): boolean {
  let limiter = memoryLimiters.get(scope);
  if (!limiter) {
    limiter = createRateLimiter(RATE_LIMITS[scope]);
    memoryLimiters.set(scope, limiter);
  }
  return limiter.check(key, now);
}

// --- Backend Upstash ---
let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const upstashLimiters = new Map<RateScope, Ratelimit>();
function getUpstashLimiter(scope: RateScope): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  let rl = upstashLimiters.get(scope);
  if (!rl) {
    const { max, windowMs } = RATE_LIMITS[scope];
    rl = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: "rl",
    });
    upstashLimiters.set(scope, rl);
  }
  return rl;
}

/** true = cho qua, false = vượt ngưỡng. Fail-open nếu Upstash lỗi. */
export async function checkRateLimit(
  scope: RateScope,
  id: string,
  now: number = Date.now(),
): Promise<boolean> {
  const key = rateKey(scope, id);
  const limiter = getUpstashLimiter(scope);
  if (!limiter) return memoryCheck(scope, key, now);
  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (e) {
    console.warn("[ratelimit] Upstash lỗi, fail-open:", e);
    return true;
  }
}
