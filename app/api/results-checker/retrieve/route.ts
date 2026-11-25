import { NextResponse } from 'next/server'
import { getResultsCheckerOrderForGuest } from '@/lib/results-checker-retrieval'
import {
    isValidResultsCheckerPhone,
    normalizeResultsCheckerPhone,
} from '@/lib/results-checker-utils'
import { checkRcRetrieveLimit } from '@/lib/rc-retrieve-ratelimit'
import { limitDistributed } from '@/lib/distributed-rate-limit'
import { getRequestIp } from '@/lib/request-ip'

// The only guest-facing endpoint that reveals voucher PINs. Three caps, all global:
//   - per IP (trusted source, see lib/request-ip.ts; the leftmost X-Forwarded-For used to
//     be read here, which a caller can rotate per request),
//   - per phone: a brute force against one buyer fixes the phone and walks references,
//   - per reference: a brute force against one receipt walks phones.
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

        const [byPhone, byRef] = await Promise.all([
            limitDistributed('rc-retrieve-phone', normalizedPhone, 10, 3600),
            limitDistributed('rc-retrieve-ref', normalizedReference, 10, 3600),
        ])
        if (!byPhone.allowed || !byRef.allowed) {
            return NextResponse.json(TOO_MANY, { status: 429 })
        }

        const result = await getResultsCheckerOrderForGuest(normalizedReference, normalizedPhone)
        if (!result) {
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
