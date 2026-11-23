import { createServerClient } from '@/lib/supabase'
import { waitUntil } from '@vercel/functions'
import { categorizeFailure, autoRefundApiOrderOnFailure } from '@/lib/api-order-failure'

/**
 * Sync a terminal airtime_orders status down to the mirrored `orders`/`shop_orders` ledger rows
 * for shop-attributed references (SHOP- storefront, USSD-AIR- USSD shop airtime, USSD-MASH- USSD
 * shop mashup). Without this, any path that finalizes airtime_orders WITHOUT going through the
 * admin PATCH route leaves the shop owner's/customer's
 * view stuck on the pre-fulfillment status forever — exactly what the admin PATCH route and webhook
 * already do; this is that same logic, shared so every finalize path stays in sync.
 */
export async function syncAirtimeShopMirror(supabase: any, referenceCode: string | null | undefined, status: string): Promise<void> {
    if (!referenceCode) return
    try {
        if (referenceCode.startsWith('SHOP-')) {
            const refSuffix = referenceCode.replace('SHOP-', '')
            await (supabase.from('orders') as any).update({ status }).eq('reference_code', referenceCode)
            const { data: sOrder } = await (supabase.from('shop_orders') as any)
                .select('id').ilike('paystack_reference', `%${refSuffix}`).single()
            if (sOrder?.id) {
                await (supabase.from('shop_orders') as any)
                    .update({ status, updated_at: new Date().toISOString() }).eq('id', sOrder.id)
            }
        } else if (referenceCode.startsWith('USSD-AIR-') || referenceCode.startsWith('USSD-MASH-')) {
            const { data: mirror } = await (supabase.from('orders') as any)
                .select('id, shop_order_id').eq('reference_code', referenceCode).maybeSingle()
            if (mirror?.id) {
                await (supabase.from('orders') as any).update({ status }).eq('id', mirror.id)
            }
            if (mirror?.shop_order_id) {
                await (supabase.from('shop_orders') as any)
                    .update({ status, updated_at: new Date().toISOString() }).eq('id', mirror.shop_order_id)
            }
        }
    } catch (e) {
        console.error('[AirtimeFulfillment] syncAirtimeShopMirror failed:', e)
    }
}

/**
 * MANUAL admin refund of a RETAIL airtime order → credits the buyer's wallet via the idempotent
 * refund_airtime_wallet RPC (refund-once, FOR UPDATE + unique-reference guarded). Completed orders
 * are never refundable; already-refunded is a no-op. SHOP airtime orders are NOT handled here —
 * they must be refunded through the shop-order refund (owner-wallet / Paystack) which also reverses
 * the shop-profit leg; this returns a skip for them.
 */
export async function manualRefundAirtime(
    orderId: string, actorId: string, reason?: string,
): Promise<{ ok: boolean; status: string; message: string; amount?: number }> {
    const supabase = createServerClient()
    const { data, error } = await (supabase as any).rpc('refund_airtime_wallet', {
        p_order_id: orderId, p_actor_id: actorId, p_reason: reason ?? 'admin airtime refund',
    })
    if (error) return { ok: false, status: 'error', message: error.message }
    if (data?.already_refunded) return { ok: true, status: 'refunded', message: 'Already refunded' }
    if (data?.ok) return { ok: true, status: 'refunded', message: 'Refunded to wallet', amount: data?.amount }
    if (data?.error === 'not_retail_airtime') {
        return { ok: false, status: 'skipped', message: 'Shop airtime — refund via the shop order (owner wallet / Paystack)' }
    }
    if (data?.error === 'not_refundable') {
        return { ok: false, status: data?.status || 'skipped', message: `Not refundable (status: ${data?.status})` }
    }
    return { ok: false, status: 'error', message: data?.error || 'Refund failed' }
}

/** Statuses an admin may still finalize. A refunded or completed order is never touched again. */
const FINALIZABLE_STATUSES = ['pending', 'processing', 'failed']
const FAILABLE_STATUSES = ['pending', 'processing']

export interface ManualFinalizeExtra {
    note?: string | null
    service?: string | null
    requestId?: string | null
    metadata?: Record<string, unknown> | null
}

function finalizeExtraColumns(extra: ManualFinalizeExtra): Record<string, unknown> {
    const cols: Record<string, unknown> = {}
    if (extra.note) cols.fulfillment_note = extra.note
    if (extra.service) cols.fulfillment_service = extra.service
    if (extra.requestId) cols.fulfillment_request_id = extra.requestId
    if (extra.metadata) cols.fulfillment_metadata = extra.metadata
    return cols
}

/** What the order is NOW, for the message when a guarded update matched nothing. */
async function currentStatus(supabase: any, orderId: string): Promise<string> {
    const { data } = await (supabase.from('airtime_orders') as any).select('status').eq('id', orderId).maybeSingle()
    return data?.status ?? 'not_found'
}

/**
 * MANUAL admin "mark completed" for a pending/processing/failed airtime or mashup order. The one
 * implementation behind both the single-order PATCH (app/api/admin/airtime/orders), the bulk
 * action and the batch screen: status update, shop-mirror sync, in-app notification, completion
 * SMS and the developer webhook.
 *
 * The status change is a single guarded UPDATE (only pending/processing/failed rows match), so a
 * refund that lands first can never be overwritten with "completed", and the follow-ups only run
 * for the call that actually performed the transition. No wallet movement here: the buyer's
 * wallet was debited when the order was placed.
 */
export async function manualCompleteAirtime(
    orderId: string, adminUserId: string, extra: ManualFinalizeExtra = {},
): Promise<{ ok: boolean; status: string; message: string }> {
    const supabase = createServerClient()
    const { data: order, error: fetchError } = await (supabase.from('airtime_orders') as any)
        .select('*').eq('id', orderId).single()
    if (fetchError || !order) return { ok: false, status: 'not_found', message: 'Order not found' }
    if (order.status === 'completed') return { ok: true, status: 'completed', message: 'Already completed' }
    if (!FINALIZABLE_STATUSES.includes(order.status)) {
        return { ok: false, status: order.status, message: `Not eligible (status: ${order.status})` }
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await (supabase.from('airtime_orders') as any)
        .update({
            ...finalizeExtraColumns(extra),
            status: 'completed',
            fulfilled_by: adminUserId,
            fulfilled_at: now,
            updated_at: now,
        })
        .eq('id', orderId).in('status', FINALIZABLE_STATUSES).select('id')
    if (updateError) return { ok: false, status: 'error', message: updateError.message }
    if (!updated || updated.length === 0) {
        const status = await currentStatus(supabase, orderId)
        return status === 'completed'
            ? { ok: true, status, message: 'Already completed' }
            : { ok: false, status, message: `Not eligible (status: ${status})` }
    }

    await syncAirtimeShopMirror(supabase, order.reference_code, 'completed')

    const orderTypeLabel = order.type === 'mashup' ? 'Mashup Bundle' : 'Airtime'
    const amount = Number(order.airtime_amount)
    ;(supabase.from('notifications') as any).insert({
        user_id: order.user_id,
        title: `${orderTypeLabel} Sent ✅`,
        message: `GHS ${amount.toFixed(2)} ${orderTypeLabel.toLowerCase()} for ${order.beneficiary_phone} has been sent successfully. Ref: ${order.reference_code}`,
        type: 'order_update',
        action_url: '/dashboard/airtime',
    }).then(() => {}).catch((e: any) => console.error('[AirtimeFulfillment] manualCompleteAirtime notification error:', e))


    import('@/lib/sms-service').then(({ sendAirtimeCompletedSMS, sendMashupCompletedSMS }) => {
        const smsFn = order.type === 'mashup' ? sendMashupCompletedSMS : sendAirtimeCompletedSMS
        return smsFn(order.beneficiary_phone, { amount })
    }).catch((e: any) => console.error('[AirtimeFulfillment] manualCompleteAirtime SMS error:', e))

    // A developer integration only learns the order landed through its webhook.
    if (order.api_key_id) {
        try {
            const { dispatchApiWebhook } = await import('@/lib/api-webhook')
            waitUntil(dispatchApiWebhook(supabase, {
                apiKeyId: order.api_key_id, event: 'order.completed', product: 'airtime',
                reference: String(order.reference_code).replace(/^API-/, ''), status: 'completed',
                detail: { network: order.network, airtime_amount: amount },
            }))
        } catch (e) { console.error('[AirtimeFulfillment] manualCompleteAirtime webhook error:', e) }
    }

    return { ok: true, status: 'completed', message: 'Marked completed' }
}

/**
 * MANUAL admin "mark failed" for a pending/processing order. Same guarantees as
 * manualCompleteAirtime: one guarded UPDATE (a completed or refunded order can never be flipped
 * to failed, which would make a delivered order refundable), then the shop-mirror sync, the
 * buyer's notification and, for developer-API orders, the automatic refund and webhook that every
 * other failure path already performs.
 */
export async function manualFailAirtime(
    orderId: string, adminUserId: string, extra: ManualFinalizeExtra = {},
): Promise<{ ok: boolean; status: string; message: string; refunded?: boolean }> {
    const supabase = createServerClient()
    const { data: order, error: fetchError } = await (supabase.from('airtime_orders') as any)
        .select('*').eq('id', orderId).single()
    if (fetchError || !order) return { ok: false, status: 'not_found', message: 'Order not found' }
    if (order.status === 'failed') return { ok: true, status: 'failed', message: 'Already failed' }
    if (!FAILABLE_STATUSES.includes(order.status)) {
        return { ok: false, status: order.status, message: `Not eligible (status: ${order.status})` }
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await (supabase.from('airtime_orders') as any)
        .update({
            ...finalizeExtraColumns(extra),
            status: 'failed',
            fulfilled_by: adminUserId,
            fulfilled_at: now,
            updated_at: now,
        })
        .eq('id', orderId).in('status', FAILABLE_STATUSES).select('id')
    if (updateError) return { ok: false, status: 'error', message: updateError.message }
    if (!updated || updated.length === 0) {
        const status = await currentStatus(supabase, orderId)
        return status === 'failed'
            ? { ok: true, status, message: 'Already failed' }
            : { ok: false, status, message: `Not eligible (status: ${status})` }
    }

    await syncAirtimeShopMirror(supabase, order.reference_code, 'failed')

    const orderTypeLabel = order.type === 'mashup' ? 'Mashup Bundle' : 'Airtime'
    ;(supabase.from('notifications') as any).insert({
        user_id: order.user_id,
        title: `${orderTypeLabel} Order Failed`,
        message: `Your ${orderTypeLabel.toLowerCase()} order ${order.reference_code} could not be completed. Please contact support.`,
        type: 'order_update',
        action_url: '/dashboard/airtime',
    }).then(() => {}).catch((e: any) => console.error('[AirtimeFulfillment] manualFailAirtime notification error:', e))

    const { code: reasonCode, message: reasonMessage } = categorizeFailure('status_check_failed')
    const refund = await autoRefundApiOrderOnFailure(supabase, {
        product: 'airtime', orderId, source: order.source, reasonCode, reasonMessage,
    })
    if (order.api_key_id) {
        try {
            const { dispatchApiWebhook } = await import('@/lib/api-webhook')
            waitUntil(dispatchApiWebhook(supabase, {
                apiKeyId: order.api_key_id, event: 'order.failed', product: 'airtime',
                reference: String(order.reference_code).replace(/^API-/, ''), status: refund.refunded ? 'refunded' : 'failed',
                detail: {
                    network: order.network, airtime_amount: Number(order.airtime_amount),
                    reason_code: reasonCode, reason: reasonMessage,
                    ...(refund.refunded ? { refunded: true, refund_amount: refund.amount, new_balance: refund.newBalance } : {}),
                },
            }))
        } catch (e) { console.error('[AirtimeFulfillment] manualFailAirtime webhook error:', e) }
    }

    return { ok: true, status: refund.refunded ? 'refunded' : 'failed', message: refund.refunded ? 'Marked failed and refunded to the developer wallet' : 'Marked failed', refunded: refund.refunded }
}
