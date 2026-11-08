import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { consumeRateLimit } from './simple-rate-limit'

// Redis-backed (GLOBAL across Vercel instances) sliding-window limiter for guest
// storefront endpoints that spend money or send SMS/MoMo prompts to a third party.
// The in-memory consumeRateLimit() resets on every cold start and is per-instance, so on
// serverless it is only a weak backstop; these callers need a shared counter that is
// keyed on something the caller cannot cheaply rotate (the payer's phone number, a
// verified IP) rather than only on a spoofable header.
//
// Never fails open: if Redis is unconfigured or errors, it degrades to the per-instance
// limiter (weaker, but non-zero) — same stance as lib/rc-retrieve-ratelimit.ts.
// Same env names as middleware.ts.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const redis = (REDIS_URL && REDIS_TOKEN) ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null

const limiters = new Map<string, Ratelimit>()

export interface DistributedLimitResult {
    allowed: boolean
    retryAfterSec: number
}

/**
 * @param bucket     short stable name for the limit, e.g. 'momo-payer'
 * @param identifier what is being limited (a phone number, an IP, ...)
 */
export async function limitDistributed(
    bucket: string,
    identifier: string,
    limit: number,
    windowSec: number,
): Promise<DistributedLimitResult> {
    if (redis) {
        try {
            const key = `${bucket}:${limit}:${windowSec}`
            let rl = limiters.get(key)
            if (!rl) {
                rl = new Ratelimit({
                    redis,
                    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s` as `${number} s`),
                    prefix: `dist:${key}`,
                })
                limiters.set(key, rl)
            }
            const { success, reset } = await rl.limit(identifier)
            return { allowed: success, retryAfterSec: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
        } catch (err) {
            console.error(`[distributed-rate-limit] Redis error for '${bucket}', using per-instance fallback:`, err)
        }
    }

    const fallback = consumeRateLimit(`dist-fallback-${bucket}:${identifier}`, limit, windowSec * 1000)
    return { allowed: fallback.allowed, retryAfterSec: Math.max(1, Math.ceil(fallback.retryAfterMs / 1000)) }
}
