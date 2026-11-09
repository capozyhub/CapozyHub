import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/api-auth'
import { limitDistributed } from '@/lib/distributed-rate-limit'
import { chargeFingerprint, withChargeDedupe } from '@/lib/charge-dedupe'

/**
 * Wraps a guest storefront MoMo charge handler (data/airtime, AFA, results-checker, utility).
 *
 * 1. Per-PAYER-number limit: these routes fire a real MoMo prompt at whatever number the
 *    caller supplies, so an attacker could spam a victim's phone by rotating IPs. The payer's
 *    number is the thing that can't be rotated, so it is limited across every charge route.
 * 2. Per-IP limit on a shared Redis window (the routes' own in-memory limits reset per
 *    lambda instance).
 * 3. Duplicate-submit dedupe: an identical request within 30s replays the first response
 *    rather than creating a second charge / second MoMo prompt.
 */
export async function guardGuestCharge(
    request: NextRequest,
    scope: string,
    handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
    const body = await request.clone().json().catch(() => null)
    if (!body || typeof body !== 'object') return handler() // handler returns its own 400

    const rawPayer = String((body as any).momoPhone ?? (body as any).momoNumber ?? '').replace(/\s+/g, '')
    const payer = /^233\d{9}$/.test(rawPayer) ? '0' + rawPayer.slice(3) : rawPayer

    if (/^0\d{9}$/.test(payer)) {
        const byPayer = await limitDistributed('momo-payer', payer, 4, 120)
        if (!byPayer.allowed) {
            return NextResponse.json(
                { error: 'Too many payment attempts for this number. Please wait a couple of minutes and try again.' },
                { status: 429, headers: { 'Retry-After': String(byPayer.retryAfterSec) } },
            )
        }
    }

    const ip = getClientIp(request)
    if (ip) {
        const byIp = await limitDistributed(`guest-charge-ip-${scope}`, ip, 12, 60)
        if (!byIp.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again in a minute.' },
                { status: 429, headers: { 'Retry-After': String(byIp.retryAfterSec) } },
            )
        }
    }

    return withChargeDedupe(chargeFingerprint([scope, JSON.stringify(body)]), handler)
}
