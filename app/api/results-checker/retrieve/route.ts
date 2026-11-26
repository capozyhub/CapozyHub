import { NextResponse } from 'next/server'
import { getResultsCheckerOrderForGuest } from '@/lib/results-checker-retrieval'
import {
    isValidResultsCheckerPhone,
    normalizeResultsCheckerPhone,
} from '@/lib/results-checker-utils'
import { checkRcRetrieveLimit } from '@/lib/rc-retrieve-ratelimit'
import { isDistributedBlocked, limitDistributed } from '@/lib/distributed-rate-limit'
import { getRequestIp } from '@/lib/request-ip'

// The only guest-facing endpoint that reveals voucher PINs. Caps:
//   - per IP on every request (trusted source, see lib/request-ip.ts; the leftmost
//     X-Forwarded-For used to be read here, which a caller can rotate per request),
//   - per phone and per reference, global: a brute force against one buyer fixes the phone
//     and walks references, or fixes a receipt and walks phones.
//   - per IP+phone and per IP+reference: stricter, and keyed so one address can only
//     spend its own budget for a given buyer.
// Only FAILED lookups are counted against the per-phone and per-reference budgets. If every
// request counted, anyone who knew a buyer's phone could post junk until that buyer's
// budget was gone and lock them out of the voucher they paid for. A correct lookup is
// never counted and never blocked by someone else's failures at the IP+phone level.
const GLOBAL_FAILS_PER_HOUR = 30
const PER_IP_FAILS_PER_HOUR = 10
const HOUR = 3600
const TOO_MANY = { error: 'Too many retrieval attempts. Please try again later.' }

export async function POST(req: Request) {
    try {
        const ip = getRequestIp(req)
        if (!(await checkRcRetrieveLimit(ip))) {
            return NextResponse.json(TOO_MANY, { status: 429 })
        }

        const { reference, phone } = await req.json()

        if (!reference || !phone) {
            return NextResponse.json({ error: 'Reference and phone number are required' }, { status: 400 })
        }

        const normalizedPhone = normalizeResultsCheckerPhone(String(phone))
        if (!isValidResultsCheckerPhone(normalizedPhone)) {
            return NextResponse.json({ error: 'Enter a valid Ghana phone number' }, { status: 400 })
        }

        const normalizedReference = String(reference).trim()
        if (!normalizedReference || normalizedReference.length > 120) {
            return NextResponse.json({ error: 'Reference code is required' }, { status: 400 })
        }

        const buckets = [
            { bucket: 'rc-retrieve-phone', id: normalizedPhone, limit: GLOBAL_FAILS_PER_HOUR },
            { bucket: 'rc-retrieve-ref', id: normalizedReference, limit: GLOBAL_FAILS_PER_HOUR },
            { bucket: 'rc-retrieve-ip-phone', id: `${ip}:${normalizedPhone}`, limit: PER_IP_FAILS_PER_HOUR },
            { bucket: 'rc-retrieve-ip-ref', id: `${ip}:${normalizedReference}`, limit: PER_IP_FAILS_PER_HOUR },
        ]

        // Look before counting: a bucket already spent by earlier failures blocks the attempt.
        const blocked = await Promise.all(buckets.map(b => isDistributedBlocked(b.bucket, b.id, b.limit, HOUR)))
        if (blocked.some(Boolean)) {
            return NextResponse.json(TOO_MANY, { status: 429 })
        }

        const result = await getResultsCheckerOrderForGuest(normalizedReference, normalizedPhone)
        if (!result) {
            // A miss is what an attacker produces, so only a miss spends the budgets.
            await Promise.all(buckets.map(b => limitDistributed(b.bucket, b.id, b.limit, HOUR)))
            return NextResponse.json(
                { error: 'Order not found or details do not match' },
                { status: 404 }
            )
        }
        return NextResponse.json(result)
    } catch (err) {
        console.error('[RC Retrieve API] Error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
