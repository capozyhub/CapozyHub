import { createAdminClient } from '@/lib/supabase-admin'

const supabaseAdmin = createAdminClient()

/**
 * No supplier is wired up yet (Capozy — see docs/stage-1-5-scope-down.md, "Suppliers").
 * This used to classify every pending data order into one of nine supplier buckets,
 * claim/dispatch/accept each bucket, run four MTN rejection-fallback chains, and
 * reconcile the results. All of that — and the per-supplier services it called —
 * has been removed. Every pending order is simply reported as skipped; it waits for
 * manual fulfillment from /admin/fulfillment. Re-adding a real supplier means
 * writing a new dispatch path here, not restoring the old one (every previous
 * supplier's wholesale pricing and API contract was specific to the prior
 * operator, KiNG FLEXY GH).
 */
export async function processRefulfillment(isCron: boolean, orderIds?: string[]) {
    let query = supabaseAdmin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .not('size', 'ilike', '%Airtime%')
        .not('size', 'ilike', '%Mashup%')
        .neq('category', 'mtn_mashup')

    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
        query = query.in('id', orderIds)
    }

    const { count, error } = await query
    if (error) {
        console.error('[ProcessRefulfill] Failed to count pending orders:', error)
        return { success: false, count: 0, fulfilled: 0, skipped: 0, failed: 0, message: 'Failed to load pending orders' }
    }

    const total = count || 0
    return {
        success: true,
        count: total,
        fulfilled: 0,
        skipped: total,
        failed: 0,
        message: total > 0
            ? `${total} order(s) have no active supplier configured and remain pending for manual fulfillment.`
            : 'No pending orders found to fulfill',
    }
}
