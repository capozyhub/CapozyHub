import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { manualRefundAirtime, manualCompleteAirtime } from '@/lib/airtime-fulfillment'

// Bulk admin airtime refund / complete. Loops the existing idempotent lib fns
// (manualRefundAirtime / manualCompleteAirtime) — each carries a double-action guard
// (refund-once, guarded status flip), so no order is ever refunded or completed twice.
// Iterated sequentially. 'refund' is admin-only (sub-admin excluded).

const MAX_BULK = 50

async function verifyAdmin(supabaseUserClient: any): Promise<{ userId: string; role: string } | null> {
    const { data: { user: authUser }, error } = await supabaseUserClient.auth.getUser()
    if (error || !authUser) return null
    const supabase = createServerClient()
    const { data: user } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (user as any)?.role
    return ['admin', 'sub-admin'].includes(role) ? { userId: authUser.id, role } : null
}

// POST { action: 'refund' | 'complete', orderIds: string[] } — bulk refund/complete airtime orders.
export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

        const action = body?.action
        if (action !== 'refund' && action !== 'complete') {
            return NextResponse.json({ error: "action must be 'refund' or 'complete'" }, { status: 400 })
        }
        // Refunds move money — strictly admin-only (sub-admin excluded).
        if (action === 'refund' && admin.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden — refunds are admin only' }, { status: 403 })
        }

        const rawIds = body?.orderIds
        if (!Array.isArray(rawIds) || rawIds.length === 0 || !rawIds.every((id: any) => typeof id === 'string' && id.length > 0 && id.length <= 100)) {
            return NextResponse.json({ error: 'orderIds must be a non-empty array of strings' }, { status: 400 })
        }

        const orderIds = Array.from(new Set(rawIds as string[]))
        if (orderIds.length > MAX_BULK) {
            return NextResponse.json({ error: 'Select at most 50 orders' }, { status: 400 })
        }

        const results: any[] = []

        // Sequential (for…of with await) — NOT Promise.all.
        for (const id of orderIds) {
            try {
                if (action === 'refund') {
                    const r = await manualRefundAirtime(id, admin.userId)
                    results.push({ orderId: id, ok: r.ok, status: r.status, message: r.message, amount: r.amount })
                } else {
                    const r = await manualCompleteAirtime(id, admin.userId)
                    results.push({ orderId: id, ok: r.ok, status: r.status, message: r.message })
                }
            } catch (e: any) {
                results.push({ orderId: id, ok: false, status: 'error', message: String(e?.message || e) })
            }
        }

        // Classify each result: ok (delivered/marked), skipped (business-rule guard refusal,
        // not a real failure), failed (a thrown error).
        const summary = { ok: 0, failed: 0, skipped: 0, total: results.length }
        for (const r of results) {
            if (r.ok === true) {
                // A no-op idempotent repeat ("Already refunded") is a skip, not a fresh success.
                if (action === 'refund' && /already refunded/i.test(String(r.message || ''))) summary.skipped++
                else summary.ok++
                continue
            }
            const guardStatus = ['not_found', 'completed', 'processing', 'skipped'].includes(r.status)
            const guardMessage = /already completed|already refunded|not refundable|refund via the shop order/i.test(String(r.message || ''))
            if (guardStatus || guardMessage) {
                summary.skipped++
            } else {
                summary.failed++
            }
        }

        return NextResponse.json({ action, summary, results }, { status: 200 })
    } catch (e: any) {
        console.error('[AirtimeBulk] error:', e?.message || e)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
