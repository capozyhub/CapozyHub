import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { manualCompleteAirtime, manualFailAirtime } from '@/lib/airtime-fulfillment'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BATCH = 200

async function verifyAdmin(supabaseUserClient: any) {
    const { data: { user: authUser }, error } = await supabaseUserClient.auth.getUser()
    if (error || !authUser) return null
    const supabase = createServerClient()
    const { data: user } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    if (!['admin', 'sub-admin'].includes((user as any)?.role)) return null
    return { userId: authUser.id }
}

// GET — list fulfillment batches
export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30') || 30))
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0)
        const status = searchParams.get('status')

        const supabase = createServerClient()
        let query = (supabase
            .from('airtime_fulfillment_batches') as any)
            .select(`*, created_by_user:users!airtime_fulfillment_batches_created_by_fkey(first_name, last_name)`, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (status && status !== 'all') query = query.eq('status', status)

        const { data: batches, error, count } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ batches: batches || [], total: count || 0 })
    } catch (err) {
        console.error('[Airtime Batches] GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST — create a new batch from selected order IDs
export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

        const { orderIds: rawOrderIds, batchName, fulfillmentService } = body ?? {}
        if (!Array.isArray(rawOrderIds) || rawOrderIds.length === 0) {
            return NextResponse.json({ error: 'orderIds array is required' }, { status: 400 })
        }
        if (!rawOrderIds.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
            return NextResponse.json({ error: 'orderIds must be valid order ids' }, { status: 400 })
        }
        const orderIds: string[] = Array.from(new Set(rawOrderIds as string[]))
        if (orderIds.length > MAX_BATCH) {
            return NextResponse.json({ error: `A batch can hold at most ${MAX_BATCH} orders` }, { status: 400 })
        }

        const supabase = createServerClient()
        const name = (typeof batchName === 'string' && batchName.trim() ? batchName.trim().slice(0, 100) : null) || `Batch ${new Date().toLocaleString('en-GH', { timeZone: 'Africa/Accra' })}`

        const { data: batch, error: createError } = await (supabase
            .from('airtime_fulfillment_batches') as any)
            .insert({
                created_by: admin.userId,
                batch_name: name,
                status: 'pending',
                order_ids: orderIds,
                order_count: orderIds.length,
                fulfillment_service: typeof fulfillmentService === 'string' ? fulfillmentService.slice(0, 100) : null,
            })
            .select()
            .single()

        if (createError) {
            console.error('[Airtime Batches] Create error:', createError)
            return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        // Mark all included orders as 'processing'
        await (supabase.from('airtime_orders') as any)
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .in('id', orderIds)
            .eq('status', 'pending')

        return NextResponse.json({ success: true, batch })
    } catch (err) {
        console.error('[Airtime Batches] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH — bulk update all orders in a batch to completed or failed
export async function PATCH(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

        const { batchId, status, failedOrderIds, fulfillmentService, fulfillmentNote } = body ?? {}
        if (typeof batchId !== 'string' || !UUID_RE.test(batchId)) return NextResponse.json({ error: 'Invalid batchId' }, { status: 400 })
        if (!status) return NextResponse.json({ error: 'batchId and status required' }, { status: 400 })
        if (!['processing', 'completed', 'failed', 'partial'].includes(status)) {
            return NextResponse.json({ error: 'Invalid batch status' }, { status: 400 })
        }

        const supabase = createServerClient()

        const { data: batch, error: fetchErr } = await (supabase
            .from('airtime_fulfillment_batches') as any)
            .select('*').eq('id', batchId).single()

        if (fetchErr || !batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

        const allOrderIds: string[] = batch.order_ids || []
        // Only orders that belong to this batch can be failed through it.
        const failedIds: string[]   = Array.isArray(failedOrderIds)
            ? failedOrderIds.filter((id: unknown): id is string => typeof id === 'string' && allOrderIds.includes(id))
            : []
        const succeededIds          = allOrderIds.filter((id: string) => !failedIds.includes(id))

        if (status === 'processing') {
            return NextResponse.json({ success: true, status: batch.status })
        }

        const now = new Date().toISOString()
        const extra = {
            note: typeof fulfillmentNote === 'string' ? fulfillmentNote.slice(0, 500) : null,
            service: typeof fulfillmentService === 'string' ? fulfillmentService.slice(0, 100) : null,
        }

        // Each order goes through the same guarded path as a single-order update, so an order
        // refunded or completed since the batch was made is skipped, never overwritten, and every
        // order gets its shop sync, notification and developer webhook.
        let completedCount = 0, failedCount = 0, skippedCount = 0
        for (const id of succeededIds) {
            const r = await manualCompleteAirtime(id, admin.userId, extra)
            if (r.ok) completedCount++; else skippedCount++
        }
        for (const id of failedIds) {
            const r = await manualFailAirtime(id, admin.userId, { ...extra, note: extra.note ?? 'Marked failed from a fulfillment batch' })
            if (r.ok) failedCount++; else skippedCount++
        }

        const resolvedStatus = failedCount === 0 && completedCount > 0 ? 'completed'
            : completedCount === 0 && failedCount > 0 ? 'failed'
            : completedCount === 0 && failedCount === 0 ? batch.status
            : 'partial'

        await (supabase.from('airtime_fulfillment_batches') as any)
            .update({
                status: resolvedStatus,
                completed_count: completedCount,
                failed_count: failedCount,
                updated_at: now,
            })
            .eq('id', batchId)

        return NextResponse.json({
            success: true,
            status: resolvedStatus,
            completedCount,
            failedCount,
            skippedCount,
        })
    } catch (err) {
        console.error('[Airtime Batches] PATCH error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
