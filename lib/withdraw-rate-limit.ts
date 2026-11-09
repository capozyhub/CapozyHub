import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { consumeRateLimit } from './simple-rate-limit'

// /api/shop/withdraw moves money and triggers a provider name lookup on every
// call, so it is capped per user. Upstash (global across instances) when
// configured; the per-instance in-memory limiter otherwise — never fail-open.
// Same env names as support-rate-limit.ts / middleware.ts.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const redis = (REDIS_URL && REDIS_TOKEN) ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null

export const WITHDRAW_MAX = 5
const WITHDRAW_WINDOW_MS = 10 * 60 * 1000

const limiter = redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(WITHDRAW_MAX, '10 m'), prefix: 'shop-withdraw' })
    : null

/** True = allowed. User-keyed, 5 withdrawal attempts / 10 minutes. */
export async function checkWithdrawLimit(userId: string): Promise<boolean> {
    if (limiter) {
        try {
            const { success } = await limiter.limit(userId)
            return success
        } catch {
            return consumeRateLimit(`shop-withdraw:${userId}`, WITHDRAW_MAX, WITHDRAW_WINDOW_MS).allowed
        }
    }
    return consumeRateLimit(`shop-withdraw:${userId}`, WITHDRAW_MAX, WITHDRAW_WINDOW_MS).allowed
}
