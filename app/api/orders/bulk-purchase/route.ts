import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { waitUntil } from '@vercel/functions'
import { getAdminOOSNetworks, isNetworkOOS } from '@/lib/network-stock'
import { resolveOrderQueueing } from '@/lib/number-registration'
import { checkMtnWhitelistGateBatch } from '@/lib/mtn-whitelist-gate'
import { resolveOwnConfirmationSender } from '@/lib/sms-confirmation-sender'
import { resolveOwnerCost } from '@/lib/pricing/cost-basis'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { toCanonicalPhone } from '@/lib/data-orders/phone'
import { findBlacklistedPhones, loadBuyer } from '@/lib/data-orders/guards'
import { placeDataOrders, type PlaceItem } from '@/lib/data-orders/place'

const MAX_BATCH = 500

interface BulkOrderItem {
    packageId: string
    phoneNumber: string
}

interface FulfillmentOutcome {
    failed: boolean
    type: 'error' | 'skipped' | 'success'
    reason?: string
    referenceCode: string
    network: string
}

/**
 * POST /api/orders/bulk-purchase: buy many bundles in one go (agents, dealers, admins).
 *
 * Prices are always worked out here from the package and the buyer's own tier: any price in
 * the request is ignored. The whole batch is paid and recorded in ONE database call, so it is
 * all-or-nothing: either every order exists and the wallet is charged once, or nothing changed.
 */
export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const userId = authUser.id

        let body: { orders?: unknown; batchReference?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { orders: rawOrders, batchReference } = body

        if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
            return NextResponse.json({ error: 'No orders provided' }, { status: 400 })
        }
        if (rawOrders.length > MAX_BATCH) {
            return NextResponse.json({ error: `Maximum ${MAX_BATCH} orders per batch` }, { status: 400 })
        }

        // Shape and phone numbers are checked row by row; the first bad row names itself.
        const orders: Array<BulkOrderItem & { recipient: string }> = []
        for (let i = 0; i < rawOrders.length; i++) {
            const row = rawOrders[i] as Partial<BulkOrderItem> | null
            if (!row || typeof row.packageId !== 'string' || !row.packageId) {
                return NextResponse.json({ error: `Row ${i + 1}: package is required` }, { status: 400 })
            }
            const recipient = toCanonicalPhone(row.phoneNumber)
            if (!recipient) {
                return NextResponse.json({ error: `Row ${i + 1}: invalid phone number` }, { status: 400 })
            }
            orders.push({ packageId: row.packageId, phoneNumber: recipient, recipient })
        }

        // Optional idempotency key for the whole batch: each order's reference is derived from it,
        // so replaying the same batch is recognised and never charged twice.
        const normalizedBatchRef =
            typeof batchReference === 'string' && /^[A-Za-z0-9_\-]{6,80}$/.test(batchReference.trim())
                ? batchReference.trim()
                : null

        const supabase = createServerClient()

        if (normalizedBatchRef) {
            const { data: existingBatch } = await (supabase.from('orders') as any)
                .select('id')
                .eq('reference_code', `${normalizedBatchRef}-0`)
                .eq('user_id', userId)
                .maybeSingle()
            if (existingBatch) return NextResponse.json({ success: true, isDuplicate: true })
        }

        const buyerResult = await loadBuyer(supabase, userId)
        if (!buyerResult.ok) {
            return NextResponse.json({ error: buyerResult.error }, { status: buyerResult.status })
        }
        const { buyer } = buyerResult

        const pricingRole = effectiveRoleFromExpiry(buyer.role, buyer.agent_expires_at, buyer.dealer_expires_at)
        const isAdminUser = buyer.role === 'admin' || buyer.role === 'sub-admin'
        if (pricingRole === 'customer' && !isAdminUser) {
            return NextResponse.json({ error: 'Bulk orders are only available to agents, dealers, and admins' }, { status: 403 })
        }

        // Sub-agents cannot buy in bulk: bulk prices by the buyer's OWN tier, which would
        // bypass the wholesale price their recruiter set.
        const { data: subMembership } = await (supabase as any)
            .from('sub_agents').select('id').eq('user_id', userId).maybeSingle()
        if (subMembership) {
            return NextResponse.json({ error: 'Bulk orders are not available for sub-agent accounts yet' }, { status: 403 })
        }

        // Packages: mashup is manual-fulfilment and never available in bulk.
        const packageIds = [...new Set(orders.map(o => o.packageId))]
        const { data: packages, error: pkgsError } = await supabase
            .from('data_packages')
            .select('*')
            .in('id', packageIds)
            .eq('is_available', true)
            .neq('category', 'mtn_mashup')

        if (pkgsError || !packages) {
            return NextResponse.json({ error: 'Failed to load packages' }, { status: 500 })
        }
        const pkgMap = new Map((packages as any[]).map(p => [p.id, p]))
        const adminOOS = await getAdminOOSNetworks(supabase)

        const problems: string[] = []
        const priced = orders.map((order, i) => {
            const pkg = pkgMap.get(order.packageId)
            if (!pkg) { problems.push(`Row ${i + 1}: package not found`); return null }
            if (isNetworkOOS(adminOOS, pkg.network)) { problems.push(`Row ${i + 1}: ${pkg.network} is out of stock`); return null }
            const price = Math.round(resolveOwnerCost(pkg, {
                role: buyer.role,
                agent_expires_at: buyer.agent_expires_at,
                dealer_expires_at: buyer.dealer_expires_at,
            }) * 100) / 100
            if (!Number.isFinite(price) || price <= 0) { problems.push(`Row ${i + 1}: package is temporarily unavailable`); return null }
            return { order, pkg, price }
        })
        if (problems.length > 0) {
            return NextResponse.json({ error: problems.slice(0, 5).join('; ') + (problems.length > 5 ? ` (+${problems.length - 5} more)` : '') }, { status: 400 })
        }
        const validated = priced as Array<{ order: typeof orders[number]; pkg: any; price: number }>

        // Blacklist: the same canonical-number check as a single purchase. Fails closed.
        let blocked: Set<string>
        try {
            blocked = await findBlacklistedPhones(supabase, validated.map(v => v.order.recipient))
        } catch (e) {
            console.error('[BulkPurchase] blacklist check unavailable:', e)
            return NextResponse.json({ error: 'We could not verify these numbers. Please try again.' }, { status: 503 })
        }
        if (blocked.size > 0) {
            return NextResponse.json({
                error: 'Some numbers are not allowed',
                numbers: validated.map(v => v.order.recipient).filter(n => blocked.has(n)).slice(0, 20),
            }, { status: 400 })
        }

        // MTN whitelist gate: blocked rows are left out entirely (never charged, never created),
        // so the buyer only pays for numbers that can be delivered to right now.
        const whitelistResults = await checkMtnWhitelistGateBatch(
            validated.map(v => ({ phoneNumber: v.order.recipient, network: v.pkg.network, category: v.pkg.category })),
        )
        const skipped: { phone: string; reason: string }[] = []
        const chargeable = validated.filter(v => {
            const result = whitelistResults.get(v.order.recipient)
            if (result?.blocked) {
                skipped.push({ phone: v.order.recipient, reason: result.reason || 'Not yet whitelisted' })
                return false
            }
            return true
        })

        if (chargeable.length === 0) {
            return NextResponse.json(
                { error: 'None of these numbers are registered to receive MTN data yet. We\'ve submitted them for registration. Please try again soon.', skipped },
                { status: 400 },
            )
        }

        // Unregistered MTN numbers are held 'queued'; decided per row (each may differ).
        const queueDecisions = await Promise.all(chargeable.map(v => resolveOrderQueueing(v.order.recipient, v.pkg.network)))

        const referenceCodes = normalizedBatchRef
            ? chargeable.map((_, i) => `${normalizedBatchRef}-${i}`)
            : chargeable.map(() => generateReferenceCode())

        const items: PlaceItem[] = chargeable.map((v, i) => ({
            reference_code: referenceCodes[i],
            phone_number: v.order.recipient,
            network: v.pkg.network,
            size: v.pkg.size,
            price: v.price,
            cost_price: Number(v.pkg.cost_price) || 0,
            role_at_time: isAdminUser ? (buyer.role as string) : pricingRole,
            status: queueDecisions[i].queue ? 'queued' : 'pending',
            fulfillment_method: 'auto',
            category: v.pkg.category || 'data',
        }))

        const placed = await placeDataOrders(supabase, userId, items)

        if (!placed.ok) {
            if (placed.code === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: 'Insufficient balance for all orders' }, { status: 400 })
            if (placed.code === 'REFERENCE_IN_USE') return NextResponse.json({ error: 'This batch reference is already in use. Please try again.' }, { status: 409 })
            return NextResponse.json({ error: placed.message }, { status: 500 })
        }
        if (placed.duplicate) return NextResponse.json({ success: true, isDuplicate: true })

        const createdOrders = placed.orders
        const totalCost = placed.total

        await (supabase.from('notifications') as any).insert({
            user_id: userId,
            title: 'Bulk order placed',
            message: `${createdOrders.length} orders have been placed. Total: GHS ${totalCost.toFixed(2)}`,
            type: 'order_update',
            action_url: '/dashboard/my-orders',
        })

        // Background: SMS, fulfilment and one combined alert for the admins.
        const userName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Customer'
        const userEmail = buyer.email || 'Unknown'
        const smsEnabled = buyer.order_success_sms_enabled !== false

        waitUntil((async () => {
            // Queued orders (unregistered MTN numbers) are held: no SMS, no dispatch.
            const dispatchable = createdOrders.filter(o => o.status !== 'queued')
            const queuedCount = createdOrders.length - dispatchable.length
            if (queuedCount > 0) {
                console.log(`[BulkPurchase] ${queuedCount}/${createdOrders.length} orders QUEUED for MTN number registration: fulfilment held`)
            }
            // The buyer's own approved sender, resolved once for the whole batch.
            const ownSender = smsEnabled ? await resolveOwnConfirmationSender(supabase, userId) : null
            const results = await Promise.allSettled(
                dispatchable.map(order => processOrderNotifications(order, { email: userEmail, name: userName }, smsEnabled, ownSender)),
            )

            const exceptions = results
                .filter((r): r is PromiseFulfilledResult<FulfillmentOutcome> => r.status === 'fulfilled' && !!r.value?.failed)
                .map(r => r.value)

            // ONE summary email to the admins if anything needs attention.
            if (exceptions.length > 0) {
                const { sendAdminBulkOrderAlert } = await import('@/lib/email-service')
                await sendAdminBulkOrderAlert({
                    totalOrders: createdOrders.length,
                    failureCount: exceptions.length,
                    failures: exceptions.map(e => ({
                        referenceCode: e.referenceCode,
                        network: e.network,
                        reason: e.reason || 'Unknown',
                        type: e.type as 'error' | 'skipped',
                    })),
                    customerName: userName,
                    customerEmail: userEmail,
                }).catch(err => console.error('[BulkPurchase] Admin alert error:', err))
            }
        })())

        return NextResponse.json({
            success: true,
            ordersPlaced: createdOrders.length,
            totalCost,
            newBalance: placed.newBalance,
            skipped,
        })
    } catch (error) {
        console.error('Bulk purchase error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/** Per-order work after the response: SMS to the recipient first, then fulfilment. */
async function processOrderNotifications(
    order: { id: string; reference_code: string; network: string; phone_number: string; size: string },
    user: { email: string; name: string },
    sendSms: boolean,
    ownSender: string | null,
): Promise<FulfillmentOutcome> {
    // An SMS failure never prevents fulfilment.
    if (sendSms) {
        const { sendOrderSuccessSMS } = await import('@/lib/sms-service')
        await sendOrderSuccessSMS(order.phone_number, {
            recipientNumber: order.phone_number,
            network: order.network,
            size: order.size,
            price: 0,
            currentBalance: 0,
            sender: ownSender ?? undefined,
        }).catch(err => console.error(`[BulkOrder] SMS error for ${order.phone_number}:`, err))
    }
    return dispatchOrder(order, user)
}

/**
 * Dispatch one order through the SHARED lib/fulfillment-trigger (all suppliers, the atomic
 * pending->processing claim, fallback chains, ambiguous-result handling). Per-order admin alerts
 * are suppressed because this route sends one combined alert for the batch.
 */
async function dispatchOrder(
    order: { id: string; reference_code: string; network: string; phone_number: string; size: string },
    user: { email: string; name: string },
): Promise<FulfillmentOutcome> {
    const { triggerFulfillment } = await import('@/lib/fulfillment-trigger')
    const outcome = await triggerFulfillment(order.id, order.network, user, { suppressAdminAlerts: true })
    return {
        failed: outcome.failed,
        type: outcome.type,
        reason: outcome.reason,
        referenceCode: order.reference_code,
        network: order.network,
    }
}
