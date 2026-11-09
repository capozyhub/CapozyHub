import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { consumeRateLimit } from './simple-rate-limit'

// Withdraw endpoints move money and trigger a provider name lookup on every call, so
// they are capped per user. Upstash (global across instances) when configured; the
// per-instance in-memory limiter otherwise — never fail-open.
// Same env names as support-rate-limit.ts / middleware.ts.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const redis = (REDIS_URL && REDIS_TOKEN) ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null

export const WITHDRAW_MAX = 5
const WITHDRAW_WINDOW_MS = 10 * 60 * 1000

const limiters = new Map<string, Ratelimit>()
function limiterFor(scope: string): Ratelimit | null {
    if (!redis) return null
    let l = limiters.get(scope)
    if (!l) {
        l = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(WITHDRAW_MAX, '10 m'), prefix: scope })
        limiters.set(scope, l)
    }
    return l
}

/** True = allowed. User-keyed, 5 withdrawal attempts / 10 minutes, counted separately per scope. */
export async function checkWithdrawLimit(userId: string, scope: 'shop-withdraw' | 'commission-withdraw' = 'shop-withdraw'): Promise<boolean> {
    const limiter = limiterFor(scope)
    if (limiter) {
        try {
            const { success } = await limiter.limit(userId)
            return success
        } catch {
            // Redis hiccup — degrade to the per-instance limiter rather than fail-open.
        }
    }
    return consumeRateLimit(`${scope}:${userId}`, WITHDRAW_MAX, WITHDRAW_WINDOW_MS).allowed
}
