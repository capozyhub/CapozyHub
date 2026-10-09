import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { waitUntil } from '@vercel/functions'
import { sendAdminAirtimeOrderEmail } from '@/lib/email-service'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { quoteAirtime, AIRTIME_NETWORK_KEY_MAP } from '@/lib/airtime-pricing'
import { toCanonicalPhone } from '@/lib/data-orders/phone'
import { findBlacklistedPhones, loadBuyer } from '@/lib/data-orders/guards'
import { isValidClientReference } from '@/lib/data-orders/place'
import { placeAirtimeOrder } from '@/lib/data-orders/place-airtime'

const NETWORKS = ['MTN', 'Telecel', 'AT'] as const
const BUNDLE_PREFERENCES = ['balanced', 'data', 'voice'] as const

/**
 * POST /api/airtime/create: airtime or MTN Mashup from the dashboard.
 *
 * Every check runs before any money moves; the debit, the order row and the ledger row are then
 * written by ONE database call (place_airtime_order). Orders start as "pending" and an admin
 * fulfils them from the fulfillment page.
 */
export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const userId = authUser.id
        const supabase = createServerClient()

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { beneficiaryPhone, network, amount, useExactAmount, referenceCode: clientReferenceCode, type, bundle_preference } = body ?? {}

        const orderType: 'airtime' | 'mashup' = type === 'mashup' ? 'mashup' : 'airtime'
        const bundlePreference = orderType === 'mashup'
            ? (BUNDLE_PREFERENCES.find(p => p === bundle_preference) ?? 'balanced')
            : null

        if (!beneficiaryPhone || !network || amount === undefined || amount === null || amount === '') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }
        if (!NETWORKS.includes(network)) {
            return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
        }
        if (orderType === 'mashup' && network !== 'MTN') {
            return NextResponse.json({ error: 'MTN Mashup is only available for MTN numbers' }, { status: 400 })
        }

        const cleanPhone = toCanonicalPhone(beneficiaryPhone)
        if (!cleanPhone) {
            return NextResponse.json({ error: 'Invalid phone number. Use a Ghana mobile number: 0XXXXXXXXX (10 digits)' }, { status: 400 })
        }

        if (clientReferenceCode !== undefined && clientReferenceCode !== null && !isValidClientReference(clientReferenceCode)) {
            return NextResponse.json({ error: 'Invalid reference' }, { status: 400 })
        }

        const parsedAmount = typeof amount === 'number' ? amount : parseFloat(String(amount))
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }

        // ── Buyer: must exist and not be suspended ────────────────────────────
        const buyerResult = await loadBuyer(supabase, userId)
        if (!buyerResult.ok) {
            return NextResponse.json({ error: buyerResult.error }, { status: buyerResult.status })
        }
        const buyer = buyerResult.buyer
        // Expiry-aware: a lapsed dealer/agent is priced as a customer everywhere.
        const userRole = effectiveRoleFromExpiry(buyer.role as any, buyer.agent_expires_at, buyer.dealer_expires_at)

        // ── Blacklist (fails closed) ──────────────────────────────────────────
        try {
            const blocked = await findBlacklistedPhones(supabase, [cleanPhone])
            if (blocked.has(cleanPhone)) {
                return NextResponse.json({ error: 'This number cannot receive orders' }, { status: 403 })
            }
        } catch (e) {
            console.error('[Airtime] blacklist check failed:', e)
            return NextResponse.json({ error: 'We could not verify this number. Please try again.' }, { status: 503 })
        }

        // ── Switches, limits and fees (server-side, per product and role) ─────
        const networkKey = AIRTIME_NETWORK_KEY_MAP[network]
        const { data: settingRows, error: settingsError } = await (supabase.from('admin_settings') as any)
            .select('key, value')
            .in('key', [
                `airtime_enabled_${networkKey}`,
                `mashup_enabled_${networkKey}`,
                `${orderType}_fee_${networkKey}_customer`,
                `${orderType}_fee_${networkKey}_agent`,
                `${orderType}_fee_${networkKey}_dealer`,
                `${orderType}_min_amount_customer`, `${orderType}_min_amount_agent`, `${orderType}_min_amount_dealer`,
                `${orderType}_max_amount_customer`, `${orderType}_max_amount_agent`, `${orderType}_max_amount_dealer`,
                'dashboard_mashup_enabled',
            ])
        if (settingsError) {
            console.error('[Airtime] settings lookup failed:', settingsError.message)
            return NextResponse.json({ error: 'Please try again in a moment.' }, { status: 503 })
        }
        const settings: Record<string, string> = {}
        for (const s of (settingRows ?? []) as Array<{ key: string; value: string }>) settings[s.key] = s.value

        if (settings[`airtime_enabled_${networkKey}`] === 'false') {
            return NextResponse.json({ error: `${network} airtime is currently unavailable. Please try another network.` }, { status: 400 })
        }
        if (orderType === 'mashup') {
            if (settings['dashboard_mashup_enabled'] !== 'true') {
                return NextResponse.json({ error: 'Mashup purchases are currently disabled' }, { status: 503 })
            }
            if (settings[`mashup_enabled_${networkKey}`] === 'false') {
                return NextResponse.json({ error: `${network} Mashup is currently unavailable. Please try again later.` }, { status: 400 })
            }
        }

        const quoted = quoteAirtime({
            settings,
            network,
            role: userRole,
            amount: parsedAmount,
            useExactAmount: !!useExactAmount,
            orderType,
        })
        if (!quoted.ok) {
            return NextResponse.json({ error: quoted.message }, { status: 400 })
        }
        const { airtimeAmount, feeAmount, totalPaid, feeRate } = quoted.quote

        // ── One transaction: debit + order + ledger ───────────────────────────
        const referenceCode = clientReferenceCode ?? generateReferenceCode()
        const placed = await placeAirtimeOrder(supabase, userId, {
            reference_code: referenceCode,
            beneficiary_phone: cleanPhone,
            network,
            type: orderType,
            bundle_preference: bundlePreference,
            airtime_amount: airtimeAmount,
            fee_rate: feeRate,
            fee_amount: feeAmount,
            total_paid: totalPaid,
            use_exact_amount: !!useExactAmount,
            user_role: userRole,
            source: 'web',
        })

        if (!placed.ok) {
            switch (placed.code) {
                case 'INSUFFICIENT_BALANCE':
                    return NextResponse.json({ error: 'Insufficient balance. Please top up your wallet.' }, { status: 400 })
                case 'RECENT_DUPLICATE':
                    return NextResponse.json({ error: placed.message, isDuplicate: true }, { status: 409 })
                case 'REFERENCE_IN_USE':
                    return NextResponse.json({ error: 'This reference is already in use. Please try again.' }, { status: 409 })
                case 'NO_WALLET':
                    return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
                case 'INVALID':
                    return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
                default:
                    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
            }
        }

        if (placed.duplicate) {
            return NextResponse.json({
                success: true,
                isDuplicate: true,
                order: { id: placed.order.id, reference_code: placed.order.reference_code, status: placed.order.status },
            })
        }

        const label = orderType === 'mashup' ? 'Mashup bundle' : 'airtime'

        // ── Best-effort follow-ups: the money and the order are already safe ──
        waitUntil((async () => {
            try {
                await (supabase.from('notifications') as any).insert({
                    user_id: userId,
                    title: orderType === 'mashup' ? 'Mashup Bundle Order Placed' : 'Airtime Order Placed',
                    message: `GHS ${airtimeAmount.toFixed(2)} ${label} for ${cleanPhone} (${network}) is pending. Ref: ${referenceCode}`,
                    type: 'order_update',
                    action_url: '/dashboard/airtime',
                })
            } catch (e) {
                console.error('[Airtime] notification failed:', e)
            }
            try {
                await sendAdminAirtimeOrderEmail({
                    referenceCode,
                    userName: `${buyer.first_name ?? ''} ${buyer.last_name ?? ''}`.trim(),
                    userEmail: buyer.email ?? '',
                    userRole,
                    beneficiaryPhone: cleanPhone,
                    network,
                    airtimeAmount,
                    feeRate,
                    feeAmount,
                    totalPaid,
                    walletBalanceAfter: placed.newBalance,
                    useExactAmount: !!useExactAmount,
                    type: orderType,
                    bundle_preference: bundlePreference,
                })
            } catch (e) {
                console.error('[Airtime] admin alert failed:', e)
            }
        })())

        return NextResponse.json({
            success: true,
            order: {
                id: placed.order.id,
                reference_code: referenceCode,
                status: 'pending',
                network,
                beneficiary_phone: cleanPhone,
                airtime_amount: airtimeAmount,
                fee_amount: feeAmount,
                total_paid: totalPaid,
                new_balance: placed.newBalance,
            },
        })
    } catch (error) {
        console.error('[Airtime] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
