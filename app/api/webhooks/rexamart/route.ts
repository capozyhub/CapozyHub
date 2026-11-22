import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { verifyRexamartSignature } from '@/lib/rexamart-webhook-signature'
import { syncShopOrderStatus } from '@/lib/shop-service'

// POST /api/webhooks/rexamart
//
// Handles order.created / order.processing / order.completed / order.failed /
// order.refunded and dispute.updated events. `data.reference` is always what WE sent
// as `reference` when placing the order (orders.id for a direct/API order, or the
// internal orders.id for a shop order — never shop_orders.id, see
// lib/shop-order-processor.ts's dispatch comment) — every lookup below matches on
// that, never on Rexamart's own order_id.
//
// order.refunded does NOT auto-credit the customer's wallet. Rexamart refunding
// itself is not the same decision as Capozy refunding the end customer (the
// customer may already have been refunded a different way, or the order may need
// review first) — this just alerts an admin to reconcile via the normal admin
// refund flow.

const REXAMART_FAILED_EVENTS = new Set(['order.failed'])

export async function POST(request: NextRequest) {
    const secret = process.env.REXAMART_WEBHOOK_SECRET
    if (!secret) {
        console.error('[RexamartWebhook] REXAMART_WEBHOOK_SECRET is not configured — rejecting all deliveries')
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    const rawBody = await request.text()
    const timestamp = request.headers.get('x-rexamart-timestamp')
    const signature = request.headers.get('x-rexamart-signature')
    const deliveryId = request.headers.get('x-rexamart-delivery')

    const verification = verifyRexamartSignature(rawBody, timestamp, signature, secret)
    if (!verification.ok) {
        console.error(`[RexamartWebhook] Signature verification failed: ${verification.reason}`)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let payload: any
    try {
        payload = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const event = payload?.event as string | undefined
    const data = payload?.data || {}
    const reference = data?.reference as string | undefined

    if (!event || !reference) {
        return NextResponse.json({ error: 'Missing event or data.reference' }, { status: 400 })
    }

    const supabase = createServerClient()

    try {
        // De-duplicate on the delivery id — Rexamart's own docs say deliveries can
        // repeat. A dedicated log table isn't needed for a single-supplier
        // integration: mtn_fulfillment_tracking already carries one row per dispatch
        // attempt, and this webhook's own guarded UPDATEs (status='processing' before
        // writing) make a replayed, already-applied event a safe no-op on its own.
        if (deliveryId) {
            console.log(`[RexamartWebhook] ${event} delivery=${deliveryId} reference=${reference}`)
        }

        if (event === 'dispute.updated') {
            // Disputes are tracked on Rexamart's side (lib/rexamart-service.ts
            // checkDispute/listDisputes) — this just surfaces a live notification so an
            // admin doesn't have to poll. No DB write: there is no local disputes table.
            console.log(`[RexamartWebhook] Dispute update for ${reference}: ${data.disputeStatus ?? data.status}`)
            return NextResponse.json({ received: true })
        }

        if (!event.startsWith('order.')) {
            return NextResponse.json({ received: true })
        }

        // `reference` could be a data-bundle order (orders.id) or an AFA registration
        // (afa_orders.id) — try the one the event data actually describes.
        const isAfa = event === 'order.completed' || event === 'order.failed' || event === 'order.processing' || event === 'order.refunded'
            ? await resolveIsAfa(supabase, reference)
            : false

        if (isAfa) {
            await handleAfaEvent(supabase, event, reference, data)
        } else {
            await handleDataOrderEvent(supabase, event, reference, data)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[RexamartWebhook] Unexpected error:', error)
        // Acknowledge anyway — Rexamart retries on non-2xx, and a transient DB error
        // here would otherwise trigger repeated retries for an event we may have
        // already partially applied. The order/afa_order itself is the source of
        // truth; a missed status transition is caught by the admin's manual view.
        return NextResponse.json({ received: true, warning: 'Processing error, logged' })
    }
}

async function resolveIsAfa(supabase: any, reference: string): Promise<boolean> {
    const { data } = await supabase.from('afa_orders').select('id').eq('id', reference).maybeSingle()
    return !!data
}

const DATA_ORDER_STATUS_MAP: Record<string, string | null> = {
    'order.created': null, // no-op — the order already exists as 'pending' locally
    'order.processing': 'processing',
    'order.completed': 'completed',
    'order.failed': 'failed',
    'order.refunded': null, // deliberately not auto-applied — see file header
}

async function handleDataOrderEvent(supabase: any, event: string, reference: string, data: any) {
    const nextStatus = DATA_ORDER_STATUS_MAP[event]

    if (event === 'order.refunded') {
        console.error(`[RexamartWebhook] Rexamart refunded order ${reference} on their side — review and refund the customer manually from /admin/orders if appropriate. Rexamart message: ${data.message || 'n/a'}`)
        return
    }
    if (nextStatus === null) return

    // Guarded on status IN ('pending','processing') so a webhook can never resurrect
    // an order an admin already resolved a different way (e.g. manually refunded).
    const { data: updated, error } = await supabase
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', reference)
        .in('status', ['pending', 'processing'])
        .select('id, shop_order_id')
        .maybeSingle()

    if (error) {
        console.error(`[RexamartWebhook] Failed to update order ${reference} to ${nextStatus}:`, error)
        return
    }
    if (!updated) {
        console.log(`[RexamartWebhook] Order ${reference} not found or already in a terminal state — ${event} is a no-op`)
        return
    }

    await (supabase.from('mtn_fulfillment_tracking') as any).insert({
        order_id: reference,
        status: nextStatus === 'completed' ? 'completed' : nextStatus,
        api_response: { supplier: 'rexamart', event, ...data },
    })

    if (updated.shop_order_id) {
        await supabase.from('shop_orders').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', updated.shop_order_id).neq('status', 'refunded')
        await syncShopOrderStatus(reference, nextStatus).catch((e: any) => console.error('[RexamartWebhook] syncShopOrderStatus failed:', e))
    }

    if (nextStatus === 'completed') {
        const { sendOrderCompletedPushNotification } = await import('@/lib/push-service')
        sendOrderCompletedPushNotification(reference).catch((e: any) => console.error('[RexamartWebhook] Push error:', e))
    } else if (nextStatus === 'failed') {
        const { sendOrderFailedPushNotification } = await import('@/lib/push-service')
        sendOrderFailedPushNotification(reference).catch((e: any) => console.error('[RexamartWebhook] Push error:', e))
    }
}

async function handleAfaEvent(supabase: any, event: string, reference: string, data: any) {
    const nextStatus = DATA_ORDER_STATUS_MAP[event]

    if (event === 'order.refunded') {
        console.error(`[RexamartWebhook] Rexamart refunded AFA order ${reference} on their side — review and refund manually from /admin/afa-management if appropriate.`)
        return
    }
    if (nextStatus === null) return

    const { data: updated, error } = await supabase
        .from('afa_orders')
        .update({ status: nextStatus, dispatch_claimed_at: null, updated_at: new Date().toISOString() })
        .eq('id', reference)
        .in('status', ['pending', 'processing'])
        .select('id, shop_id')
        .maybeSingle()

    if (error) {
        console.error(`[RexamartWebhook] Failed to update afa_order ${reference} to ${nextStatus}:`, error)
        return
    }
    if (!updated) {
        console.log(`[RexamartWebhook] AFA order ${reference} not found or already in a terminal state — ${event} is a no-op`)
        return
    }

    if (nextStatus === 'completed' && updated.shop_id) {
        const { data: creditResult, error: creditError } = await supabase.rpc('credit_shop_afa_profit', { p_afa_order_id: updated.id })
        if (creditError || creditResult?.success === false) {
            console.error(`[RexamartWebhook] AFA profit credit failed for ${updated.id}:`, creditError ?? creditResult?.message)
        }
    }
}
