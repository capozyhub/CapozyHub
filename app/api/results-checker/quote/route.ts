import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { getMaxQuantity, getTypeById, isRCEnabled, priceVoucherOrder } from '@/lib/results-checker-service'
import { SUB_AGENT_PRICING_UNAVAILABLE_MESSAGE, SUB_AGENT_PRICING_UNAVAILABLE_STATUS } from '@/lib/results-checker-pricing'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { loadBuyer } from '@/lib/data-orders/guards'

/**
 * GET /api/results-checker/quote?typeId=…&quantity=…
 *
 * The exact price this member would pay right now, worked out by the same code the purchase uses
 * (role, bulk tier, sub-agent pricing, cost floor). The page shows this instead of guessing, and
 * sends the total back with the purchase so a price change in between is caught, not charged.
 */
export async function GET(request: NextRequest) {
    try {
        const supabaseUser = await createRouteClient()
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const typeId = request.nextUrl.searchParams.get('typeId') ?? ''
        const quantity = parseInt(request.nextUrl.searchParams.get('quantity') ?? '', 10)
        if (!typeId || !Number.isInteger(quantity) || quantity < 1) {
            return NextResponse.json({ error: 'typeId and a positive quantity are required' }, { status: 400 })
        }

        const db = createServerClient() as any
        const buyerResult = await loadBuyer(db, user.id)
        if (!buyerResult.ok) return NextResponse.json({ error: buyerResult.error }, { status: buyerResult.status })
        const { buyer } = buyerResult
        const userRole = effectiveRoleFromExpiry(buyer.role, buyer.agent_expires_at, buyer.dealer_expires_at)

        if (!(await isRCEnabled())) return NextResponse.json({ error: 'Results Checker is currently unavailable' }, { status: 503 })
        const maxQty = await getMaxQuantity()
        if (quantity > maxQty) return NextResponse.json({ error: `Maximum ${maxQty} vouchers per order` }, { status: 400 })

        const type = await getTypeById(typeId)
        if (!type || !type.is_active) return NextResponse.json({ error: 'Voucher type not found or unavailable' }, { status: 404 })

        const { breakdown } = await priceVoucherOrder(db, { userId: user.id, userRole, type, quantity })
        const bulk = breakdown.appliedBulkTier

        return NextResponse.json(
            {
                success: true,
                quote: {
                    typeId,
                    quantity,
                    unitPrice: breakdown.unitPrice,
                    total: breakdown.total,
                    bulkApplied: !!bulk,
                },
            },
            { headers: { 'Cache-Control': 'private, no-store' } },
        )
    } catch (error: any) {
        if (error?.message === 'SUB_AGENT_PRICING_UNAVAILABLE') {
            return NextResponse.json({ error: SUB_AGENT_PRICING_UNAVAILABLE_MESSAGE }, { status: SUB_AGENT_PRICING_UNAVAILABLE_STATUS })
        }
        console.error('[RC Quote] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}