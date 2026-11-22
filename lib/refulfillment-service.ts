import { createAdminClient } from '@/lib/supabase-admin'
import { fulfillOrdersBulk, isRexamartConfigured, type OrderToFulfill, type BulkOrderResult } from '@/lib/rexamart-service'
import { syncShopOrderStatus } from '@/lib/shop-service'
import { sendAdminNewOrderAlert } from '@/lib/email-service'
import { claimBulkForDispatch, acceptBulkDispatch, releaseBulkClaims } from '@/lib/dispatch-claim'

const supabaseAdmin = createAdminClient()

/**
 * Bulk refulfillment — the cron/admin "retry every pending order" path. Rexamart is
 * Capozy's one data-bundle supplier; everything here is a single bucket (no per-supplier
 * classification, no MTN-rejection fallback chain — those existed for the prior 9-supplier
 * setup and are not reintroduced for one supplier). A future second supplier should
 * reintroduce that classification, not bolt onto this file ad hoc.
 */
export async function processRefulfillment(isCron: boolean, orderIds?: string[]) {
    const { data: settingsData } = await supabaseAdmin
        .from('admin_settings')
        .select('key, value')
        .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings', 'auto_refulfill_enabled', 'auto_refulfill_threshold_mins'])

    const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value
        return acc
    }, {})

    if (isCron && settingsMap.auto_refulfill_enabled !== 'true') {
        return { skipped: true, count: 0, fulfilled: 0, failed: 0, message: 'Auto-refulfill is disabled globally.' }
    }
    if (settingsMap.auto_fulfillment_enabled === 'false') {
        return { success: true, count: 0, fulfilled: 0, skipped: 0, failed: 0, message: 'Global auto-fulfillment is disabled.' }
    }

    const fulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
        ? JSON.parse(settingsMap.fulfillment_settings)
        : (settingsMap.fulfillment_settings || {})
    const rexamartNetworks: Record<string, boolean> = fulfillmentSettings.rexamart_networks || {}
    const thresholdMins = parseInt(settingsMap.auto_refulfill_threshold_mins || '5', 10)

    let query = (supabaseAdmin
        .from('orders')
        .select('id, network, phone_number, size, status, user_id, price, shop_order_id, reference_code, created_at')
        .eq('status', 'pending')
        .not('size', 'ilike', '%Airtime%')
        .not('size', 'ilike', '%Mashup%')
        .neq('category', 'mtn_mashup') as any)
        .order('created_at', { ascending: true })

    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
        query = query.in('id', orderIds)
    }
    if (isCron) {
        const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        query = query.lt('created_at', twoMinsAgo)
    }

    const { data: pendingOrders, error: fetchError } = await query
    if (fetchError) throw fetchError
    if (!pendingOrders || pendingOrders.length === 0) {
        return { success: true, count: 0, fulfilled: 0, skipped: 0, failed: 0, message: 'No pending orders found to fulfill' }
    }

    // Bulk cooldown check (cron only) — skip an order that failed recently.
    const cooldownSet = new Set<string>()
    if (isCron) {
        const allIds = pendingOrders.map((o: any) => o.id)
        const { data: recentFailures } = await supabaseAdmin
            .from('mtn_fulfillment_tracking')
            .select('order_id, created_at')
            .in('order_id', allIds)
            .eq('status', 'failed')
            .order('created_at', { ascending: false })

        const lastFailureMap = new Map<string, number>()
        for (const row of (recentFailures || [])) {
            const t = new Date(row.created_at).getTime()
            if (!lastFailureMap.has(row.order_id) || t > lastFailureMap.get(row.order_id)!) {
                lastFailureMap.set(row.order_id, t)
            }
        }
        const cutoff = Date.now() - thresholdMins * 60 * 1000
        for (const [orderId, lastFailTime] of lastFailureMap) {
            if (lastFailTime > cutoff) cooldownSet.add(orderId)
        }
    }

    let skipped = 0
    const eligible: OrderToFulfill[] = []
    if (isRexamartConfigured()) {
        for (const order of pendingOrders as any[]) {
            if (cooldownSet.has(order.id)) { skipped++; continue }
            if (rexamartNetworks[order.network] !== true) { skipped++; continue }
            eligible.push({
                id: order.id,
                phone_number: order.phone_number,
                network: order.network,
                size: order.size,
                shop_order_id: order.shop_order_id || null,
                reference_code: order.reference_code,
                price: order.price,
            })
        }
    } else {
        skipped = pendingOrders.length
    }

    if (eligible.length === 0) {
        return { success: true, count: pendingOrders.length, fulfilled: 0, skipped, failed: 0, message: 'All orders skipped (no active supplier, unsupported network, or cooldown)' }
    }

    // ── Atomic claim: only still-pending, unclaimed-or-expired rows dispatch ──
    const lockedIds = await claimBulkForDispatch(supabaseAdmin, eligible.map(o => o.id), 'rexamart')
    const notLocked = eligible.length - lockedIds.size
    skipped += notLocked
    const locked = eligible.filter(o => lockedIds.has(o.id))

    if (locked.length === 0) {
        return { success: true, count: pendingOrders.length, fulfilled: 0, skipped, failed: 0, message: 'All eligible orders were locked by a concurrent process' }
    }

    const results: BulkOrderResult[] = await fulfillOrdersBulk(locked)

    const trackingInserts = results.map(r => ({
        order_id: r.orderId,
        status: r.success ? 'processing' : 'failed',
        api_response: { note: `${isCron ? 'Cron' : 'Manual'} Bulk Refulfill ${r.success ? 'Success' : 'Failed'} via rexamart`, supplier: 'rexamart', ...(r.success ? {} : { error: r.error }) },
    }))
    if (trackingInserts.length > 0) {
        const { error: trackingError } = await supabaseAdmin.from('mtn_fulfillment_tracking').insert(trackingInserts)
        if (trackingError) console.error('[ProcessRefulfill] Tracking insert error:', trackingError)
    }

    const successes = results.filter(r => r.success)
    const definiteFailures = results.filter(r => !r.success && !r.ambiguous)
    const ambiguousFailures = results.filter(r => !r.success && r.ambiguous)

    if (definiteFailures.length > 0) {
        const failedIds = definiteFailures.map(r => r.orderId)
        const revertedIdSet = await releaseBulkClaims(supabaseAdmin, failedIds)
        const orderMap = new Map(locked.map(o => [o.id, o]))
        const failedShopIds = failedIds
            .filter(id => revertedIdSet.has(id))
            .map(id => orderMap.get(id)?.shop_order_id)
            .filter((id): id is string => !!id)
        if (failedShopIds.length > 0) {
            await supabaseAdmin.from('shop_orders').update({ status: 'pending' }).in('id', failedShopIds)
        }
    }

    let ambiguousAcceptedIds = new Set<string>()
    if (ambiguousFailures.length > 0) {
        console.error(`[ProcessRefulfill] ${ambiguousFailures.length} order(s) hit an ambiguous transport failure — marking 'processing' to avoid a possible double-charge/double-deliver. Manual reconciliation required.`)
        ambiguousAcceptedIds = await acceptBulkDispatch(supabaseAdmin, ambiguousFailures.map(r => r.orderId))
        const orderMap = new Map(locked.map(o => [o.id, o]))
        await Promise.allSettled(
            ambiguousFailures.map(r => {
                const order = orderMap.get(r.orderId)
                return sendAdminNewOrderAlert({
                    referenceCode: `AMBIGUOUS-REFULFILL-${r.orderId}`,
                    phoneNumber: order?.phone_number || 'N/A',
                    network: order?.network || 'unknown',
                    size: order?.size || 'unknown',
                    price: order?.price ?? 0,
                    customerName: 'Shop Guest',
                    customerEmail: 'N/A',
                    source: 'shop_storefront',
                    shopName: isCron ? 'Auto Refulfill Cron' : 'Admin Refulfill',
                    reason: `⚠️ AMBIGUOUS_TRANSPORT_FAILURE: order ${r.orderId} left in 'processing' — the Rexamart request may have already been queued/charged before the connection dropped (${r.error || 'unknown error'}). Do NOT resubmit without confirming with Rexamart first.`,
                }).catch((e: any) => console.error(`[ProcessRefulfill] Ambiguous-failure alert error for ${r.orderId}:`, e))
            })
        )
    }

    // Accept successes: flip status to 'processing' + store the supplier reference.
    const acceptedIds = new Set<string>()
    await Promise.allSettled(
        successes.map(r =>
            supabaseAdmin
                .from('orders')
                .update({
                    status: 'processing',
                    fulfillment_method: 'rexamart',
                    supplier_reference: r.rexamartOrderId || null,
                    dispatch_claimed_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', r.orderId)
                .eq('status', 'pending')
                .select('id')
                .maybeSingle()
                .then(({ data, error }: any) => {
                    if (error) { console.error(`[ProcessRefulfill] Accept failed for ${r.orderId}:`, error); return }
                    if (data) acceptedIds.add(r.orderId)
                })
        )
    )

    const orderMap = new Map(locked.map(o => [o.id, o]))
    await Promise.allSettled(
        successes
            .filter(r => acceptedIds.has(r.orderId))
            .map(r => {
                const order = orderMap.get(r.orderId)
                if (!order?.shop_order_id) return null
                return supabaseAdmin.from('shop_orders').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', order.shop_order_id)
                    .then(({ error }) => { if (error) console.error(`[ProcessRefulfill] shop_orders update failed for ${r.orderId}:`, error) })
            })
            .filter((p): p is Promise<void> => p !== null)
    )

    const syncAll = [
        ...successes.filter(r => acceptedIds.has(r.orderId)).map(r => () => syncShopOrderStatus(r.orderId, 'processing').catch((e: any) => console.error(`[ProcessRefulfill] syncShopOrderStatus failed for ${r.orderId}:`, e))),
        ...ambiguousFailures.filter(r => ambiguousAcceptedIds.has(r.orderId)).map(r => () => syncShopOrderStatus(r.orderId, 'processing').catch((e: any) => console.error(`[ProcessRefulfill] syncShopOrderStatus (ambiguous) failed for ${r.orderId}:`, e))),
        ...definiteFailures.map(r => () => syncShopOrderStatus(r.orderId, 'pending').catch((e: any) => console.error(`[ProcessRefulfill] syncShopOrderStatus revert failed for ${r.orderId}:`, e))),
    ]
    const SYNC_CONCURRENCY = 10
    for (let i = 0; i < syncAll.length; i += SYNC_CONCURRENCY) {
        await Promise.allSettled(syncAll.slice(i, i + SYNC_CONCURRENCY).map(fn => fn()))
    }

    console.log(`[ProcessRefulfill] Done. Fulfilled: ${successes.length}, Skipped: ${skipped}, Failed: ${results.length - successes.length}`)

    return {
        success: true,
        count: pendingOrders.length,
        fulfilled: successes.length,
        skipped,
        failed: results.length - successes.length,
    }
}
