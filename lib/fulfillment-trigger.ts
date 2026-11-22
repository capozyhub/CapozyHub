import { createServerClient } from '@/lib/supabase'
import { shouldAutoFulfill } from '@/lib/mashup'

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
 * No supplier is wired up yet (Capozy — see docs/stage-1-5-scope-down.md, "Suppliers").
 * Every eligible order is left `pending` for manual fulfillment from
 * /admin/fulfillment, and an admin is alerted once so nothing goes unnoticed.
 * The claim/accept/release primitives this used to call (lib/dispatch-claim.ts)
 * and the per-supplier fulfillment/webhook/cron code they were wired to have all
 * been removed — re-adding a real supplier means writing a new dispatch branch
 * here, not restoring the old one (every previous supplier's wholesale pricing
 * and API contract was specific to the prior operator, KiNG FLEXY GH).
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

        console.log(`[Fulfillment] No active supplier configured — order ${orderId} kept pending for manual fulfillment.`)
        if (!options?.suppressAdminAlerts) {
            await sendAdminNewOrderAlert({
                referenceCode: (order as any).reference_code,
                phoneNumber: (order as any).phone_number,
                network: (order as any).network,
                size: (order as any).size,
                price: (order as any).price,
                customerName: user.name,
                customerEmail: user.email,
                source: 'main_site' as const,
                reason: `No active supplier configured for network: ${network}`,
            }).catch((err: any) => console.error('[Fulfillment] Admin alert failed:', err))
        }
        return { failed: true, type: 'skipped', reason: `No active supplier configured for network: ${network}` }
    } catch (error: any) {
        console.error(`[Fulfillment] Error processing order ${orderId}:`, error)
        return { failed: true, type: 'error', reason: `Exception: ${error?.message || 'Unknown error'}` }
    }
}
