import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { manualCompleteAirtime, manualFailAirtime } from '@/lib/airtime-fulfillment'

async function verifyAdmin(supabaseUserClient: any) {
    const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
    if (authError || !authUser) return null
    const supabase = createServerClient()
    const { data: user } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (user as any)?.role
    if (!['admin', 'sub-admin'].includes(role)) return null
    return { userId: authUser.id, role }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET — list all airtime orders (admin)
export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const supabase = createServerClient()
        const { searchParams } = new URL(request.url)
        const status  = searchParams.get('status')
        const network = searchParams.get('network')
        const type    = searchParams.get('type')   // 'airtime' | 'mashup'
        // Only characters a reference or phone number can contain: the value is spliced into a
        // PostgREST filter string, where commas and parentheses would add filter clauses.
        const search  = (searchParams.get('search') || '').replace(/[^A-Za-z0-9_\-+. ]/g, '').trim().slice(0, 60)
        const page    = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
        const limit   = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '30') || 30))
        const offset  = (page - 1) * limit

        let query = (supabase.from('airtime_orders') as any)
            .select(`
                *,
                users!airtime_orders_user_id_fkey(first_name, last_name, email, phone_number),
                fulfilled_by_user:users!airtime_orders_fulfilled_by_fkey(first_name, last_name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (status  && status  !== 'all') query = query.eq('status',  status)
        if (network && network !== 'all') query = query.eq('network', network)
        if (type    && type    !== 'all') query = query.eq('type',    type)
        if (search) {
            query = query.or(`reference_code.ilike.%${search}%,beneficiary_phone.ilike.%${search}%`)
        }

        const { data: orders, error, count } = await query

        if (error) {
            console.error('[Admin Airtime] List error:', error)
            return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
        }

        return NextResponse.json({
            orders: orders || [],
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit)
        })
    } catch (error) {
        console.error('[Admin Airtime] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH — update order status (admin). Every transition is a guarded, single-statement update, so
// it can never overwrite a refunded or completed order.
export async function PATCH(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const admin = await verifyAdmin(supabaseUserClient)
        if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        let body: any
        try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

        const { orderId, status, fulfillmentNote, fulfillmentService, fulfillmentRequestId, fulfillmentMetadata } = body ?? {}

        if (!orderId || !status) return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 })
        if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
            return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
        }
        if (!['processing', 'completed', 'failed'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }
        if (status === 'failed' && !fulfillmentNote) {
            return NextResponse.json({ error: 'A reason note is required when marking as failed' }, { status: 400 })
        }

        const extra = {
            note: typeof fulfillmentNote === 'string' ? fulfillmentNote.slice(0, 500) : null,
            service: typeof fulfillmentService === 'string' ? fulfillmentService.slice(0, 100) : null,
            requestId: typeof fulfillmentRequestId === 'string' ? fulfillmentRequestId.slice(0, 200) : null,
            metadata: fulfillmentMetadata && typeof fulfillmentMetadata === 'object' && !Array.isArray(fulfillmentMetadata) ? fulfillmentMetadata : null,
        }

        if (status === 'processing') {
            const supabase = createServerClient()
            const now = new Date().toISOString()
            const { data: moved, error } = await (supabase.from('airtime_orders') as any)
                .update({
                    status: 'processing',
                    ...(extra.note ? { fulfillment_note: extra.note } : {}),
                    ...(extra.service ? { fulfillment_service: extra.service } : {}),
                    ...(extra.requestId ? { fulfillment_request_id: extra.requestId } : {}),
                    ...(extra.metadata ? { fulfillment_metadata: extra.metadata } : {}),
                    updated_at: now,
                })
                .eq('id', orderId).eq('status', 'pending').select('id')
            if (error) {
                console.error('[Admin Airtime] Update error:', error)
                return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
            }
            if (!moved || moved.length === 0) {
                return NextResponse.json({ error: 'Only a pending order can be moved to processing' }, { status: 409 })
            }
            return NextResponse.json({ success: true, status })
        }

        const result = status === 'completed'
            ? await manualCompleteAirtime(orderId, admin.userId, extra)
            : await manualFailAirtime(orderId, admin.userId, extra)

        if (!result.ok) {
            return NextResponse.json({ error: result.message }, { status: result.status === 'not_found' ? 404 : 409 })
        }
        return NextResponse.json({ success: true, status: result.status })
    } catch (error) {
        console.error('[Admin Airtime] Unexpected PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
