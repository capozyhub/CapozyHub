import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

// Short-window idempotency for guest storefront MoMo charges.
//
// Without this, two identical POSTs (a double-tap while the terms fetch is still in
// flight, a flaky-network retry, a second tab) each reach Paystack and each fire a real
// MoMo prompt under a DIFFERENT reference — the customer can approve both and pay twice.
// The first request claims a fingerprint (Redis SET NX); an identical request inside the
// window gets the first request's response back (same reference, so the client just polls
// the original charge) instead of creating a second one.
//
// The window is deliberately short: it only needs to cover a double-submit, and a customer
// who is declined and retries a moment later must be allowed a fresh attempt.
const WINDOW_SEC = 30

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const redis = (REDIS_URL && REDIS_TOKEN) ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null

// Per-instance fallback when Redis is unavailable — still catches the common same-instance
// double-tap, which is the case this exists for.
const memory = new Map<string, { value: ChargeSlot; expireAt: number }>()

type ChargeResult = { body: unknown; status: number }
type ChargeSlot = 'inflight' | ChargeResult

function memGet(key: string): ChargeSlot | undefined {
    const e = memory.get(key)
    if (!e) return undefined
    if (e.expireAt < Date.now()) { memory.delete(key); return undefined }
    return e.value
}

/** Stable fingerprint of "who is paying for exactly what". */
export function chargeFingerprint(parts: Array<string | number | null | undefined>): string {
    const h = crypto.createHash('sha256').update(parts.map(p => String(p ?? '')).join('|')).digest('hex')
    return `charge-dedupe:${h}`
}

type Claim =
    | { state: 'new' }
    | { state: 'inflight' }
    | { state: 'done'; result: ChargeResult }

async function begin(key: string): Promise<Claim> {
    if (redis) {
        try {
            const ok = await redis.set(key, 'inflight', { nx: true, ex: WINDOW_SEC })
            if (ok) return { state: 'new' }
            const existing = await redis.get<ChargeSlot>(key)
            if (existing && typeof existing === 'object' && 'status' in existing) return { state: 'done', result: existing }
            return { state: 'inflight' }
        } catch (err) {
            console.error('[charge-dedupe] Redis error, using per-instance fallback:', err)
        }
    }
    const existing = memGet(key)
    if (existing === undefined) {
        memory.set(key, { value: 'inflight', expireAt: Date.now() + WINDOW_SEC * 1000 })
        return { state: 'new' }
    }
    return existing === 'inflight' ? { state: 'inflight' } : { state: 'done', result: existing }
}

async function finish(key: string, result: ChargeResult): Promise<void> {
    if (redis) {
        try { await redis.set(key, result, { ex: WINDOW_SEC }); return } catch { /* fall through to memory */ }
    }
    memory.set(key, { value: result, expireAt: Date.now() + WINDOW_SEC * 1000 })
}

async function abort(key: string): Promise<void> {
    memory.delete(key)
    if (redis) { try { await redis.del(key) } catch { /* the key simply expires */ } }
}

/**
 * Runs `run` at most once per fingerprint per window. A duplicate gets the original
 * successful response replayed (or a 409 while the original is still in flight). A failed
 * run (status >= 400, or a throw) releases the claim so the customer can retry immediately.
 */
export async function withChargeDedupe(
    fingerprint: string,
    run: () => Promise<NextResponse>,
): Promise<NextResponse> {
    const claim = await begin(fingerprint)
    if (claim.state === 'done') return NextResponse.json(claim.result.body, { status: claim.result.status })
    if (claim.state === 'inflight') {
        return NextResponse.json(
            { error: 'Your payment is already being started. Please wait a moment and check your phone.' },
            { status: 409 },
        )
    }

    try {
        const res = await run()
        if (res.status < 400) {
            const body = await res.clone().json().catch(() => null)
            if (body !== null) await finish(fingerprint, { body, status: res.status })
            else await abort(fingerprint)
        } else {
            await abort(fingerprint)
        }
        return res
    } catch (err) {
        await abort(fingerprint)
        throw err
    }
}
