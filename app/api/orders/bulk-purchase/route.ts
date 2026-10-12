import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { waitUntil } from '@vercel/functions'
import { getAdminOOSNetworks, isNetworkOOS } from '@/lib/network-stock'
import { resolveOwnerCost } from '@/lib/pricing/cost-basis'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { toCanonicalPhone, recipientMatchesNetwork } from '@/lib/data-orders/phone'
import { findBlacklistedPhones, loadBuyer } from '@/lib/data-orders/guards'
import { placeDataOrders, isValidWebReference, type PlaceItem } from '@/lib/data-orders/place'
import { mapWithLimit } from '@/lib/data-orders/pool'

const MAX_BATCH = 500

// Functions on this project are limited to 60s (vercel.json). Dispatch stops starting new
// orders at 45s so the admin alert for whatever was not reached still gets sent.
const DISPATCH_CONCURRENCY = 20
const DISPATCH_BUDGET_MS = 45_000

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

        let body: { orders?: unknown; batchReference?: unknown; expectedTotal?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        // expectedTotal is what the buyer was shown for the whole batch. If the real total has
        // moved since, the batch is refused instead of charging a different amount.
        const { orders: rawOrders, batchReference, expectedTotal } = body

        if (batchReference !== undefined && batchReference !== null && !isValidWebReference(batchReference)) {
            return NextResponse.json({ error: 'Invalid batchReference' }, { status: 400 })
        }
        if (expectedTotal !== undefined && (typeof expectedTotal !== 'number' || !Number.isFinite(expectedTotal))) {
            return NextResponse.json({ error: 'Invalid expectedTotal' }, { status: 400 })
        }
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
        const normalizedBatchRef = typeof batchReference === 'string' ? batchReference : null

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
            if (!recipientMatchesNetwork(order.recipient, pkg.network)) { problems.push(`Row ${i + 1}: number is not on ${pkg.network}`); return null }
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

        const batchTotal = Math.round(validated.reduce((sum, v) => sum + v.price, 0) * 100) / 100
        if (expectedTotal !== undefined && Math.abs(expectedTotal - batchTotal) >= 0.005) {
            return NextResponse.json({
                error: `The total has changed to GHS ${batchTotal.toFixed(2)}. Please preview the batch again.`,
                code: 'PRICE_CHANGED',
                total: batchTotal,
            }, { status: 409 })
        }

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

        const referenceCodes = normalizedBatchRef
            ? validated.map((_, i) => `${normalizedBatchRef}-${i}`)
            : validated.map(() => generateReferenceCode())

        const items: PlaceItem[] = validated.map((v, i) => ({
            reference_code: referenceCodes[i],
            phone_number: v.order.recipient,
            network: v.pkg.network,
            size: v.pkg.size,
            price: v.price,
            cost_price: Number(v.pkg.cost_price) || 0,
            role_at_time: isAdminUser ? (buyer.role as string) : pricingRole,
            status: 'pending',
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

        // Everything from here on runs after the response. The member has already paid, so
        // nothing in it may be awaited before the response or be able to turn it into an
        // error: a failed notification must never stop the orders being dispatched.
        const userName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'Customer'
        const userEmail = buyer.email || 'Unknown'

        waitUntil((async () => {
            try {
                await (supabase.from('notifications') as any).insert({
                    user_id: userId,
                    title: 'Bulk order placed',
                    message: `${createdOrders.length} orders have been placed. Total: GHS ${totalCost.toFixed(2)}`,
                    type: 'order_update',
                    action_url: '/dashboard/my-orders',
                })
            } catch (e) {
                console.error('[BulkPurchase] notification failed:', e)
            }

            // A bounded number at a time, and a time budget inside the function limit: 500
            // supplier calls at once would hit rate limits, and a function killed halfway
            // would leave orders unreported. Anything not reached is named in the admin alert.
            const deadline = Date.now() + DISPATCH_BUDGET_MS
            const results = await mapWithLimit(
                createdOrders,
                DISPATCH_CONCURRENCY,
                order => dispatchOrder(order, { email: userEmail, name: userName }),
                deadline,
            )

            const exceptions: FulfillmentOutcome[] = []
            results.forEach((r, i) => {
                const order = createdOrders[i]
                if (r.state === 'done') {
                    if (r.value.failed) exceptions.push(r.value)
                } else if (r.state === 'error') {
                    console.error(`[BulkPurchase] dispatch threw for ${order.reference_code}:`, r.error)
                    exceptions.push({ failed: true, type: 'error', reason: r.error instanceof Error ? r.error.message : 'Dispatch failed', referenceCode: order.reference_code, network: order.network })
                } else {
                    exceptions.push({ failed: true, type: 'skipped', reason: 'Not dispatched before the time limit: refulfil it from the admin fulfilment page', referenceCode: order.reference_code, network: order.network })
                }
            })

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
        })
    } catch (error) {
        console.error('Bulk purchase error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
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
