import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { validateCronAuth } from '@/lib/cron-utils'
import { createServerClient } from '@/lib/supabase'
import { dispatchAirtimeFulfillment } from '@/lib/airtime-fulfillment'
import { checkCommissionStatus } from '@/lib/hubtel-commission-status'
import { categorizeFailure, autoRefundApiOrderOnFailure } from '@/lib/api-order-failure'
import { dispatchApiWebhook } from '@/lib/api-webhook'

export async function GET(request: NextRequest) {
    const authError = validateCronAuth(request)
    if (authError) return authError

    const supabase = createServerClient()
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    const autoStatusCheck = (process.env.HUBTEL_COMMISSION_STATUSCHECK_AUTO || '').toLowerCase() === 'true'

    // (a) processing but callback never arrived (>5min) → reconcile via the Hubtel Status Check API.
    // We RECORD the status-check result on every run, but only MOVE money state (complete/fail) when
    // HUBTEL_COMMISSION_STATUSCHECK_AUTO === 'true' (default off) — until the Commission Services
    // status-check contract is validated against a real transaction. We NEVER blind re-dispatch a
    // processing order (double-send risk).
    const { data: stuck } = await (supabase.from('airtime_orders') as any)
        .select('id, reference_code, fulfillment_request_id, fulfillment_metadata, user_id, source, api_key_id')
        .eq('fulfillment_service', 'hubtel-commission')
        .eq('status', 'processing')
        .lt('updated_at', fiveMinAgo)
        .limit(50)

    let statusChecked = 0, autoCompleted = 0, autoFailed = 0
    for (const o of (stuck || [])) {
        if (!o.reference_code) continue // need the ClientReference to status-check
        const result = await checkCommissionStatus(o.fulfillment_metadata?.client_reference || o.reference_code).catch(() => null)
        if (!result) continue
        if (!result.configured) break // not configured (no collection account) → leave the rest for manual review

        statusChecked++
        const meta: Record<string, unknown> = {
            ...(o.fulfillment_metadata || {}),
            status_check: { verdict: result.verdict, http_ok: result.httpOk, at: new Date().toISOString(), error: result.error, raw: result.raw },
        }

        if (autoStatusCheck && result.verdict === 'success') {
            // Commission is captured at dispatch/callback (Meta.Commission); the status-check response has none.
            const { data: done } = await (supabase.from('airtime_orders') as any)
                .update({ status: 'completed', fulfilled_at: new Date().toISOString(), fulfillment_metadata: meta, updated_at: new Date().toISOString() })
                .eq('id', o.id).eq('status', 'processing').select('id')
            if (done?.length) autoCompleted++
        } else if (autoStatusCheck && result.verdict === 'failed') {
            const { data: failed } = await (supabase.from('airtime_orders') as any)
                .update({ status: 'failed', fulfillment_metadata: meta, updated_at: new Date().toISOString() })
                .eq('id', o.id).eq('status', 'processing').select('id')
            if (failed?.length) {
                autoFailed++
                const { code: reasonCode, message: reasonMessage } = categorizeFailure('status_check_failed')
                const refund = await autoRefundApiOrderOnFailure(supabase, {
                    product: 'airtime', orderId: o.id, source: o.source, reasonCode, reasonMessage,
                })
                if (o.api_key_id) {
                    waitUntil(dispatchApiWebhook(supabase, {
                        apiKeyId: o.api_key_id, event: 'order.failed', product: 'airtime',
                        reference: (o.reference_code || '').replace(/^API-/, ''), status: refund.refunded ? 'refunded' : 'failed',
                        detail: {
                            reason_code: reasonCode, reason: reasonMessage,
                            ...(refund.refunded ? { refunded: true, refund_amount: refund.amount, new_balance: refund.newBalance } : {}),
                        },
                    }))
                }
            }
        } else {
            // auto off, or pending/unknown — record the status-check result, leave status untouched.
            await (supabase.from('airtime_orders') as any)
                .update({ fulfillment_metadata: meta, updated_at: new Date().toISOString() })
                .eq('id', o.id).eq('status', 'processing')
        }
    }

    const stuckRemaining = (stuck || []).length - autoCompleted - autoFailed
    if (stuckRemaining > 0) {
        console.warn(`[HubtelCommissionReconcile] ${stuckRemaining} processing order(s) stuck >5min (auto=${autoStatusCheck}) — review /admin/airtime`)
    }

    // (b) pending hubtel orders with attempts remaining → re-dispatch. dispatchAirtimeFulfillment runs the
    // priorAttemptVerdict() double-send guard before sending, so a unique-per-attempt reference stays safe.
    const { data: pending } = await (supabase.from('airtime_orders') as any)
        .select('id')
        .eq('fulfillment_service', 'hubtel-commission')
        .eq('status', 'pending')
        .lt('airtime_fulfillment_attempts', 5)
        .limit(50)

    let dispatched = 0
    for (const o of (pending || [])) {
        try { await dispatchAirtimeFulfillment(o.id); dispatched++ } catch { /* continue */ }
    }

    return NextResponse.json({
        success: true,
        dispatched,
        statusChecked,
        autoCompleted,
        autoFailed,
        stuckRemaining,
    })
}
