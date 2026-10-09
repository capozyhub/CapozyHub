import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id
        const supabase = createServerClient()

        const { searchParams } = new URL(request.url)
        const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
        const offset = (page - 1) * limit

        const { data: orders, error, count } = await (supabase.from('airtime_orders') as any)
            .select(
                'id, reference_code, beneficiary_phone, network, type, bundle_preference, airtime_amount, fee_amount, total_paid, use_exact_amount, status, fulfillment_note, created_at, updated_at, fulfilled_at, refunded_at, refund_reason',
                { count: 'exact' }
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('[Airtime History] Error:', error)
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
        console.error('[Airtime History] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
