import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { waitUntil } from '@vercel/functions'
import { triggerFulfillment } from '@/lib/fulfillment-trigger'
import { shouldAutoFulfill, isMashupCategory } from '@/lib/mashup'
import { sendAdminPushNotification } from '@/lib/push-service'
import { getAdminOOSNetworks, isNetworkOOS } from '@/lib/network-stock'
import { resolveOwnerCost } from '@/lib/pricing/cost-basis'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { resolveSubAgentContext } from '@/lib/sub-agent-account'
import { resolveSubAgentDataCost } from '@/lib/sub-agent-data-pricing'
import { hasSubAgentPricingConfigured } from '@/lib/sub-agent-pricing'
import { recordPendingSubAgentEarning } from '@/lib/sub-agent-earnings'
import { resolveOrderQueueing } from '@/lib/number-registration'
import { checkMtnWhitelistGate } from '@/lib/mtn-whitelist-gate'
import { toCanonicalPhone } from '@/lib/data-orders/phone'
import { findBlacklistedPhones, loadBuyer } from '@/lib/data-orders/guards'
import { placeDataOrders, isValidClientReference } from '@/lib/data-orders/place'

/**
 * POST /api/orders/purchase: buy one data bundle from the wallet.
 *
 * Order of work, and why it matters:
 *   1. Everything that can say no runs BEFORE any money moves: sign-in, input, stock,
 *      blacklist, whitelist, account status, price.
 *   2. The money, the order and the ledger row are written by ONE database call
 *      (place_data_orders), so a failure never leaves a charge without an order.
 *   3. Notifications and fulfilment run after the response is sent.
 */
export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const userId = authUser.id

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        // The browser makes up a reference for each purchase attempt. It is the idempotency
        // key: sending the same one twice (double tap, retry) can never buy twice.
        const { packageId, phoneNumber, referenceCode: clientReferenceCode } = body

        if (!packageId || typeof packageId !== 'string') {
            return NextResponse.json({ error: 'Package ID is required' }, { status: 400 })
        }
        if (clientReferenceCode !== undefined && !isValidClientReference(clientReferenceCode)) {
            return NextResponse.json({ error: 'Invalid referenceCode' }, { status: 400 })
        }

        // One canonical number from here on. The blacklist, the whitelist, the stored order and
        // the supplier call all see the same spelling, so none of them can be sidestepped by
        // writing the number differently (for example 233... instead of 0...).
        const recipient = toCanonicalPhone(phoneNumber)
        if (!recipient) {
            return NextResponse.json({
                error: 'Invalid phone number. Use a Ghana mobile number: 0XXXXXXXXX or 233XXXXXXXXX',
            }, { status: 400 })
        }

        // Service role for privileged reads and the purchase itself.
        const supabase = createServerClient()

        // Replay of a purchase that already went through: hand back the same order.
        if (clientReferenceCode) {
            const existing = await findOwnOrder(supabase, userId, clientReferenceCode)
            if (existing) return duplicateResponse(existing)
        }

        const { data: pkg, error: pkgError } = await supabase
            .from('data_packages')
            .select('*')
            .eq('id', packageId)
            .eq('is_available', true)
            .single()

        if (pkgError || !pkg) {
            return NextResponse.json({ error: 'Package not found' }, { status: 404 })
        }
        const p = pkg as any

        // Out-of-stock is enforced here too: hiding it in the UI is not a control.
        const adminOOS = await getAdminOOSNetworks(supabase)
        if (isNetworkOOS(adminOOS, p.network)) {
            return NextResponse.json({ error: `${p.network} is out of stock at the moment` }, { status: 409 })
        }

        let blocked: Set<string>
        try {
            blocked = await findBlacklistedPhones(supabase, [recipient])
        } catch (e) {
            console.error('[Purchase] blacklist check unavailable:', e)
            return NextResponse.json({ error: 'We could not verify this number. Please try again.' }, { status: 503 })
        }
        if (blocked.has(recipient)) {
            return NextResponse.json({ error: 'This phone number is not allowed' }, { status: 400 })
        }

        // MTN whitelist gate: independent of the number-registration queue below. When the admin
        // switch is on, an MTN number the supplier has not whitelisted is refused outright
        // (no charge, no order).
        const whitelistGate = await checkMtnWhitelistGate(recipient, p.network, p.category)
        if (whitelistGate.blocked) {
            return NextResponse.json({ error: whitelistGate.reason }, { status: 400 })
        }

        const buyerResult = await loadBuyer(supabase, userId)
        if (!buyerResult.ok) {
            return NextResponse.json({ error: buyerResult.error }, { status: buyerResult.status })
        }
        const { buyer } = buyerResult

        const pricingRole = effectiveRoleFromExpiry(buyer.role, buyer.agent_expires_at, buyer.dealer_expires_at)

        // A sub-agent buys at the price their recruiter set; the recruiter earns the markup.
        // Eligibility is read live, so a pending or suspended sub, or one whose recruiter is
        // currently ineligible, cannot buy.
        const subCtx = await resolveSubAgentContext(supabase, userId)
        if (subCtx.isSub && !subCtx.effectiveActive) {
            return NextResponse.json({ error: subCtx.inactiveReason || 'Your account is not currently active' }, { status: 403 })
        }

        let priceToCharge = resolveOwnerCost(p, {
            role: buyer.role,
            agent_expires_at: buyer.agent_expires_at,
            dealer_expires_at: buyer.dealer_expires_at,
        })

        let recruiterMargin: { recruiterId: string; amount: number } | null = null
        if (subCtx.isSub) {
            // "No pricing configured" and "zero markup" both resolve to markup 0, so the
            // listing page hiding the package is not enough: refuse a raw API call too.
            // Mashup is exempt: its markup is always zero, so nothing is ever "configured".
            if (
                !isMashupCategory(p.category)
                && subCtx.recruiterId
                && !(await hasSubAgentPricingConfigured(supabase, subCtx.recruiterId, userId, 'data', packageId))
            ) {
                return NextResponse.json({ error: 'Pricing is not available for this package right now' }, { status: 409 })
            }

            const resolved = await resolveSubAgentDataCost(supabase, userId, packageId, pkg, p.category)
            if (!resolved.ok) {
                console.error(`[Purchase] sub cost unresolvable for pkg ${packageId} (user ${userId}): ${resolved.reason}`)
                return NextResponse.json({ error: 'Pricing is not available for this package right now' }, { status: 409 })
            }
            priceToCharge = resolved.subCost
            if (resolved.recruiterEarns > 0 && resolved.recruiterId) {
                recruiterMargin = { recruiterId: resolved.recruiterId, amount: resolved.recruiterEarns }
            }
        }

        // Price floor: a broken package row must never ship free data.
        if (!Number.isFinite(priceToCharge) || priceToCharge <= 0) {
            console.error(`[Purchase] Invalid price ${priceToCharge} for pkg ${packageId} (user ${userId}), blocked`)
            return NextResponse.json({ error: 'This package is temporarily unavailable' }, { status: 409 })
        }
        priceToCharge = Math.round(priceToCharge * 100) / 100

        // An unregistered MTN recipient is held as 'queued' until the supplier confirms the
        // number. Manual categories (mashup) are never auto-fulfilled, so they are never queued.
        const autoFulfil = shouldAutoFulfill(p.category)
        const queueDecision = autoFulfil
            ? await resolveOrderQueueing(recipient, p.network)
            : { queue: false, canonicalPhone: null }

        const referenceCode: string = clientReferenceCode || generateReferenceCode()

        const placed = await placeDataOrders(supabase, userId, [{
            reference_code: referenceCode,
            phone_number: recipient,
            network: p.network,
            size: p.size,
            price: priceToCharge,
            cost_price: Number(p.cost_price) || 0,
            role_at_time: ['admin', 'sub-admin', 'subagent'].includes(buyer.role ?? '') ? (buyer.role as string) : pricingRole,
            status: queueDecision.queue ? 'queued' : 'pending',
            fulfillment_method: autoFulfil ? 'auto' : 'manual',
            category: p.category || 'data',
        }])

        if (!placed.ok) {
            if (placed.code === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
            if (placed.code === 'REFERENCE_IN_USE') {
                // A concurrent request with our own reference just won the race: that is a replay.
                const existing = clientReferenceCode ? await findOwnOrder(supabase, userId, clientReferenceCode) : null
                if (existing) return duplicateResponse(existing)
                return NextResponse.json({ error: 'This reference is already in use. Please try again.' }, { status: 409 })
            }
            return NextResponse.json({ error: placed.message }, { status: 500 })
        }
        if (placed.duplicate) {
            const existing = await findOwnOrder(supabase, userId, referenceCode)
            if (existing) return duplicateResponse(existing)
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
        }

        const order = placed.orders[0]
        const newBalance = placed.newBalance

        // The recruiter's cut is a pending row now and is credited by a trigger only once the
        // order completes. It never blocks the sale: the buyer has paid, the data must ship.
        if (recruiterMargin) {
            await recordPendingSubAgentEarning(supabase, {
                orderReference: referenceCode,
                orderTable: 'orders',
                recruiterId: recruiterMargin.recruiterId,
                subUserId: userId,
                amount: recruiterMargin.amount,
            }).catch((e) => console.error('[Purchase] recordPendingSubAgentEarning threw:', e))
        }

        // Everything below runs after the response is sent; waitUntil keeps the function alive.
        waitUntil((async () => {
            try {
                await (supabase.from('notifications') as any).insert({
                    user_id: userId,
                    title: 'Order placed',
                    message: `Your order for ${p.size} to ${recipient} has been placed and is being processed.`,
                    type: 'order_update',
                    action_url: '/dashboard/my-orders',
                })

                const firstName = buyer.first_name || 'Customer'

                if (queueDecision.queue) {
                    console.log(`[Purchase] Order ${order.id} QUEUED for MTN number registration: fulfilment held`)
                } else if (autoFulfil) {
                    await triggerFulfillment(order.id, p.network, {
                        email: buyer.email || 'Unknown',
                        name: `${firstName} ${buyer.last_name || ''}`.trim() || 'Customer',
                    })
                } else if (isMashupCategory(p.category)) {
                    // Manual categories get no auto-fulfilment, so tell the admins to process it.
                    await sendAdminPushNotification({
                        title: 'New Special MTN Mashup Order',
                        body: `${p.size} (GHS ${priceToCharge.toFixed(2)}) for ${recipient}: needs manual fulfillment.`,
                        url: '/admin/mtn-mashup',
                    }).catch((err: Error) => console.error('[Purchase] Mashup admin push failed:', err))
                }
            } catch (postPurchaseError) {
                console.error('[Purchase] Post-purchase work failed:', postPurchaseError)
            }
        })())

        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                reference_code: referenceCode,
                status: order.status,
                network: p.network,
                size: p.size,
                phone_number: recipient,
                price: priceToCharge,
                new_balance: newBalance,
            },
        })
    } catch (error) {
        console.error('Purchase error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/** The caller's own order for a reference. Scoped to the user so a reference can never reveal anyone else's order. */
async function findOwnOrder(supabase: any, userId: string, referenceCode: string) {
    const { data } = await supabase
        .from('orders')
        .select('id, reference_code, status')
        .eq('reference_code', referenceCode)
        .eq('user_id', userId)
        .maybeSingle()
    return data as { id: string; reference_code: string; status: string } | null
}

function duplicateResponse(order: { id: string; reference_code: string; status: string }) {
    return NextResponse.json({
        success: true,
        isDuplicate: true,
        order: { id: order.id, reference_code: order.reference_code, status: order.status },
    })
}
