// AFA registrations never had a supplier dispatch path before Rexamart — they were
// always completed manually by an admin (see the design note previously in
// lib/shop-afa-order-processor.ts). The owner explicitly asked for Rexamart to cover
// "all products it supports", including AFA, so this file is new, not a restoration.
//
// Kept deliberately simple (no lib/dispatch-claim.ts-style shared claim module): there
// is exactly one supplier and one dispatch entry point per order, so a single atomic
// UPDATE is enough to prevent a double-dispatch. If a second AFA supplier is ever added,
// generalize this into the same claim/accept/release shape lib/dispatch-claim.ts uses
// for `orders`.
import { fulfillAfaOrder } from '@/lib/rexamart-service'

export interface AfaDispatchOutcome {
    dispatched: boolean
    reason?: string
}

/**
 * Attempts to auto-dispatch a just-created, still-`pending` afa_orders row to
 * Rexamart. Never throws — every failure path leaves the row `pending` for manual
 * completion and alerts an admin, exactly like the data-bundle dispatch paths.
 */
export async function triggerAfaFulfillment(
    db: any,
    afaOrderId: string,
    data: { fullName: string; phone: string; region: string; occupation: string; idNumber: string }
): Promise<AfaDispatchOutcome> {
    try {
        const { data: settingsRows } = await db
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'rexamart_afa_enabled'])
        const settings: Record<string, string> = {}
        ;(settingsRows || []).forEach((r: any) => { settings[r.key] = r.value })

        if (settings.auto_fulfillment_enabled === 'false') {
            return { dispatched: false, reason: 'Global auto-fulfillment is disabled' }
        }
        if (settings.rexamart_afa_enabled !== 'true') {
            return { dispatched: false, reason: 'Rexamart AFA dispatch is not enabled' }
        }

        // Atomic claim: only a still-pending, not-yet-claimed row can be dispatched.
        const { data: claimed, error: claimError } = await db
            .from('afa_orders')
            .update({ dispatch_claimed_at: new Date().toISOString(), fulfillment_method: 'rexamart' })
            .eq('id', afaOrderId)
            .eq('status', 'pending')
            .is('dispatch_claimed_at', null)
            .select('id')
            .maybeSingle()

        if (claimError) {
            console.error(`[AfaDispatch] Claim failed for ${afaOrderId}:`, claimError)
            return { dispatched: false, reason: 'Claim failed' }
        }
        if (!claimed) {
            return { dispatched: false, reason: 'Already claimed, or no longer pending' }
        }

        const result = await fulfillAfaOrder({
            customerName: data.fullName,
            customerPhone: data.phone,
            region: data.region,
            occupation: data.occupation,
            cardId: data.idNumber,
            orderId: afaOrderId,
        })

        if (result.success) {
            const { error: acceptError } = await db
                .from('afa_orders')
                .update({
                    status: 'processing',
                    supplier_reference: result.reference || result.rexamartAfaOrderId || null,
                    dispatch_claimed_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', afaOrderId)
            if (acceptError) console.error(`[AfaDispatch] Accept-write failed for ${afaOrderId}:`, acceptError)
            return { dispatched: true }
        }

        if (result.ambiguous) {
            // Rexamart may already have accepted/charged this registration even though the
            // call reports failure (a transport fault, not a definite rejection) — leave it
            // claimed-and-processing rather than reopening it to a second dispatch attempt.
            await db.from('afa_orders')
                .update({ status: 'processing', updated_at: new Date().toISOString() })
                .eq('id', afaOrderId)
            console.error(`[AfaDispatch] AMBIGUOUS outcome for ${afaOrderId}: ${result.error}. Left 'processing' for manual reconciliation.`)
            return { dispatched: true, reason: 'Ambiguous transport failure — manual reconciliation required' }
        }

        // Definite failure — release the claim so the row is a normal pending
        // registration again (fulfillment_method is left as 'rexamart' so the admin can
        // see what was tried; it is overwritten on the next dispatch attempt either way).
        await db.from('afa_orders').update({ dispatch_claimed_at: null }).eq('id', afaOrderId)
        return { dispatched: false, reason: result.error || 'Rexamart AFA dispatch failed' }
    } catch (error: any) {
        console.error(`[AfaDispatch] Exception for ${afaOrderId}:`, error)
        await db.from('afa_orders').update({ dispatch_claimed_at: null }).eq('id', afaOrderId).catch(() => {})
        return { dispatched: false, reason: `Exception: ${error?.message || 'Unknown error'}` }
    }
}
