import { createServerClient } from '@/lib/supabase'
import { shouldAutoFulfill } from '@/lib/mashup'
import { fulfillOrder as rexamartFulfillOrder, isRexamartConfigured } from '@/lib/rexamart-service'
import { claimForDispatch, acceptDispatch, releaseClaim } from '@/lib/dispatch-claim'

/**
 * What happened to one order. Returned so a BULK caller can aggregate many
 * outcomes into a single admin email instead of this function emitting one
 * alert per order — see `suppressAdminAlerts` below.
 */
export interface TriggerFulfillmentOutcome {
    failed: boolean
    type: 'success' | 'skipped' | 'error'
    reason?: string
    /** The supplier actually dispatched to, when one was. */
    supplier?: string
}

/**
 * Rexamart is Capozy's one data-bundle supplier (see docs/stage-1-5-scope-down.md,
 * "Suppliers", and the Rexamart integration pass that followed it). Enabled per
 * network via admin_settings.fulfillment_settings.rexamart_networks — disabled
 * (or an unsupported network) leaves the order `pending` for manual fulfillment
 * from /admin/fulfillment, with one admin alert so nothing goes unnoticed.
 */
export async function triggerFulfillment(
    orderId: string,
    network: string,
    user: { email: string, name: string },
    options?: {
        dispatchKey?: string
        /** Suppress this function's OWN per-order admin alert (bulk callers report instead). */
        suppressAdminAlerts?: boolean
    }
): Promise<TriggerFulfillmentOutcome> {
    try {
        const { sendAdminNewOrderAlert } = await import('@/lib/email-service')
        const supabase = createServerClient()

        const alertAdmin = async (reason: string) => {
            if (options?.suppressAdminAlerts) return
            await sendAdminNewOrderAlert({
                referenceCode: (order as any)?.reference_code,
                phoneNumber: (order as any)?.phone_number,
                network: (order as any)?.network,
                size: (order as any)?.size,
                price: (order as any)?.price,
                customerName: user.name,
                customerEmail: user.email,
                source: 'main_site' as const,
                reason,
            }).catch((err: any) => console.error('[Fulfillment] Admin alert failed:', err))
        }

        const { data: order } = await supabase
            .from('orders')
            .select('id, category, reference_code, phone_number, network, size, price')
            .eq('id', orderId)
            .single()

        if (!order) {
            console.error(`[Fulfillment] Order ${orderId} not found`)
            return { failed: true, type: 'error', reason: 'Order not found' }
        }

        if (!shouldAutoFulfill((order as any).category)) {
            console.log(`[Fulfillment] Skipping auto-fulfillment for manual category=${(order as any).category}, order=${orderId}`)
            return { failed: false, type: 'skipped', reason: `Manual category: ${(order as any).category}` }
        }

        const { data: settingsRows } = await supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])
        const settingsMap: Record<string, any> = {}
        ;(settingsRows || []).forEach((r: any) => { settingsMap[r.key] = r.value })

        if (settingsMap.auto_fulfillment_enabled === 'false') {
            await alertAdmin('Global auto-fulfillment is disabled')
            return { failed: true, type: 'skipped', reason: 'Global auto-fulfillment is disabled' }
        }

        const fulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
            ? JSON.parse(settingsMap.fulfillment_settings)
            : (settingsMap.fulfillment_settings || {})
        const rexamartNetworks: Record<string, boolean> = fulfillmentSettings.rexamart_networks || {}
        const rexamartEnabled = isRexamartConfigured() && rexamartNetworks[network] === true

        if (!rexamartEnabled) {
            console.log(`[Fulfillment] No active supplier for network ${network}. Order ${orderId} kept pending.`)
            await alertAdmin(`No active supplier configured for network: ${network}`)
            return { failed: true, type: 'skipped', reason: `No active supplier configured for network: ${network}` }
        }

        // ── Claim (NOT a status flip — see lib/dispatch-claim.ts) ───────────
        const claimed = await claimForDispatch(supabase, orderId, 'rexamart')
        if (!claimed) {
            console.log(`[Fulfillment] Order ${orderId} could not be claimed for rexamart (not pending, or already claimed), skipping`)
            return { failed: false, type: 'success', reason: 'Already claimed by another worker' }
        }

        const result = await rexamartFulfillOrder(network, (order as any).phone_number, (order as any).size, orderId, options?.dispatchKey ?? orderId)

        if (result.success) {
            const accepted = await acceptDispatch(supabase, orderId, 'rexamart', {
                supplier_reference: result.transactionReference || result.rexamartOrderId || null,
            })
            if (accepted) {
                await (supabase.from('mtn_fulfillment_tracking') as any).insert({
                    order_id: orderId,
                    status: 'processing',
                    retry_count: 0,
                    api_response: { supplier: 'rexamart', reference: result.transactionReference, network },
                })
            } else {
                console.log(`[Fulfillment] Order ${orderId} accept was a no-op — a webhook already resolved it`)
            }
            return { failed: false, type: 'success', supplier: 'rexamart' }
        }

        if (result.ambiguous) {
            console.error(`[Fulfillment] AMBIGUOUS dispatch outcome for order ${orderId} via rexamart: ${result.error}. Marking 'processing' for manual reconciliation.`)
            const ambiguousAccepted = await acceptDispatch(supabase, orderId, 'rexamart', {})
            if (ambiguousAccepted) {
                await alertAdmin(`⚠️ AMBIGUOUS_TRANSPORT_FAILURE: order ${orderId} left in 'processing' — the Rexamart request may have already been accepted/charged (${result.error || 'unknown error'}). Do NOT resubmit without confirming with Rexamart first.`)
            }
            return { failed: true, type: 'error', reason: `AMBIGUOUS: Rexamart request may already have been accepted (${result.error}) — manual reconciliation required`, supplier: 'rexamart' }
        }

        console.warn(`[Fulfillment] Rexamart failed for order ${orderId}: ${result.error}`)
        const released = await releaseClaim(supabase, orderId)
        if (!released) {
            console.log(`[Fulfillment] Order ${orderId} claim was already gone when releasing after a Rexamart failure — a concurrent webhook likely already resolved it`)
        }
        await alertAdmin(`Auto-fulfillment API error (rexamart): ${result.error || 'Unknown error'}`)
        await (supabase.from('mtn_fulfillment_tracking') as any).insert({
            order_id: orderId,
            status: 'failed',
            retry_count: 0,
            api_response: { error: result.error, supplier: 'rexamart', network },
        })
        return { failed: true, type: 'error', reason: `Auto-fulfillment API error (rexamart): ${result.error || 'Unknown error'}`, supplier: 'rexamart' }
    } catch (error: any) {
        console.error(`[Fulfillment] Error processing order ${orderId}:`, error)
        return { failed: true, type: 'error', reason: `Exception: ${error?.message || 'Unknown error'}` }
    }
}
