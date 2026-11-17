import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminAccess } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(true, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }

        const body = await request.json()
        const { batchId } = body

        if (!batchId) {
            return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // 1. Get all orders in this batch that are failed
        const { data: batchOrders, error: ordersError } = await supabase
            .from('orders')
            .select('id, user_id, status, price')
            .eq('download_batch_id', batchId)
            .eq('status', 'failed')

        if (ordersError) {
            console.error('Failed to load batch orders:', ordersError)
            return NextResponse.json({ error: 'Failed to load batch orders' }, { status: 500 })
        }

        if (!batchOrders || batchOrders.length === 0) {
            return NextResponse.json({ error: 'No failed orders found in this batch' }, { status: 404 })
        }

        const orderIds = batchOrders.map((o: any) => o.id)
        const failedOrderCount = batchOrders.length

        // 2. Delete the failed orders
        const { error: deleteError } = await supabase
            .from('orders')
            .delete()
            .in('id', orderIds)

        if (deleteError) {
            console.error('Failed to delete failed orders:', deleteError)
            return NextResponse.json({ error: 'Failed to delete orders' }, { status: 500 })
        }

        // 3. Re-count what's actually left in the batch — a batch mixes failed orders with
        // completed/processing ones, so it is not necessarily empty just because its failed
        // orders are gone. The previous version unconditionally zeroed order_count and
        // deleted the batch row here, which would silently orphan any surviving orders'
        // download_batch_id reference (they'd vanish from the Downloaded History tab).
        const { count: remaining, error: countError } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('download_batch_id', batchId)

        if (countError) {
            // The deletion above already succeeded — don't fail the request over a
            // bookkeeping read, just leave order_count stale rather than guessing.
            console.error('Failed to recount batch orders:', countError)
        } else {
            const { error: batchUpdateError } = await (supabase
                .from('download_batches') as any)
                .update({ order_count: remaining || 0 })
                .eq('id', batchId)
            if (batchUpdateError) console.error('Failed to update batch order_count:', batchUpdateError)

            if ((remaining || 0) === 0) {
                const { error: batchDeleteError } = await supabase
                    .from('download_batches')
                    .delete()
                    .eq('id', batchId)
                if (batchDeleteError) console.error('Failed to delete empty batch:', batchDeleteError)
            }
        }

        return NextResponse.json({
            success: true,
            deletedCount: failedOrderCount,
            message: `Deleted ${failedOrderCount} failed order(s)`
        })
    } catch (error) {
        console.error('Failed Order Deletion Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
