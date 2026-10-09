import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import {
    isRCEnabled,
    getMaxQuantity,
    getAvailableCount,
    getTypeById,
    purchaseWithWallet,
} from '@/lib/results-checker-service'
import {
    SUB_AGENT_PRICING_UNAVAILABLE_MESSAGE,
    SUB_AGENT_PRICING_UNAVAILABLE_STATUS,
} from '@/lib/results-checker-pricing'
import { deliverVouchers } from '@/lib/results-checker-notification-service'
import { phoneSchema, emailSchema } from '@/lib/validation'
import { effectiveRoleFromExpiry } from '@/lib/effective-role'
import { loadBuyer } from '@/lib/data-orders/guards'
import { isValidClientReference } from '@/lib/data-orders/place'
import { generateReferenceCode } from '@/lib/utils'

/**
 * POST /api/results-checker/purchase
 *
 * Authenticated wallet purchase. Every check runs before any money moves; the debit, the order,
 * the vouchers and the ledger row are then written by ONE database call (see purchaseWithWallet).
 */
export async function POST(request: NextRequest) {
    try {
        const supabaseUserClient = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id
        const supabase = createServerClient()

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { typeId, quantity, recipientPhone, recipientEmail, referenceCode: clientReference } = body ?? {}

        if (!typeId || !quantity) {
            return NextResponse.json({ error: 'Missing required fields: typeId, quantity' }, { status: 400 })
        }
        const parsedQuantity = parseInt(String(quantity), 10)
        if (isNaN(parsedQuantity) || parsedQuantity < 1) {
            return NextResponse.json({ error: 'Quantity must be a positive integer' }, { status: 400 })
        }
        if (clientReference !== undefined && clientReference !== null && !isValidClientReference(clientReference)) {
            return NextResponse.json({ error: 'Invalid reference' }, { status: 400 })
        }

        // ── Buyer: must exist and not be suspended ────────────────────────
        const buyerResult = await loadBuyer(supabase, userId)
        if (!buyerResult.ok) {
            return NextResponse.json({ error: buyerResult.error }, { status: buyerResult.status })
        }
        const buyer = buyerResult.buyer
        // Expiry-aware: a lapsed reseller is priced as a customer, same as every other surface.
        const userRole = effectiveRoleFromExpiry(buyer.role, buyer.agent_expires_at, buyer.dealer_expires_at)

        if (!(await isRCEnabled())) {
            return NextResponse.json({ error: 'Results Checker is currently unavailable' }, { status: 503 })
        }

        const maxQty = await getMaxQuantity()
        if (parsedQuantity > maxQty) {
            return NextResponse.json({ error: `Maximum ${maxQty} vouchers per order` }, { status: 400 })
        }

        const type = await getTypeById(typeId)
        if (!type || !type.is_active) {
            return NextResponse.json({ error: 'Voucher type not found or unavailable' }, { status: 404 })
        }

        // Fast, friendly rejection. The real guarantee is inside the transaction.
        const available = await getAvailableCount(typeId)
        if (available < parsedQuantity) {
            return NextResponse.json({ error: `Insufficient stock. Available: ${available}`, available }, { status: 400 })
        }

        // Optional recipient details; fall back to the member's own. Stored on the order so a
        // later resend (button or retry cron) has someone to deliver to.
        const rawRecipientPhone = recipientPhone ? String(recipientPhone).trim() : ''
        const rawRecipientEmail = recipientEmail ? String(recipientEmail).trim() : ''
        if (rawRecipientPhone && !phoneSchema.safeParse(rawRecipientPhone).success) {
            return NextResponse.json({ error: 'Invalid recipient phone number' }, { status: 400 })
        }
        if (rawRecipientEmail && !emailSchema.safeParse(rawRecipientEmail).success) {
            return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 })
        }
        const customerPhone = rawRecipientPhone || buyer.phone_number || null
        const customerEmail = rawRecipientEmail || buyer.email || null
        const customerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || null

        const { order, vouchers, newBalance, duplicate } = await purchaseWithWallet({
            userId,
            userRole,
            typeId,
            quantity: parsedQuantity,
            customerPhone,
            customerEmail,
            customerName,
            referenceCode: clientReference ?? `RC-${generateReferenceCode()}`,
            dedupeSeconds: 30,
        })

        // Vouchers go out after the response. A replayed order was already delivered the first time.
        if (!duplicate) {
            const orderForDelivery = { ...order, customer_phone: customerPhone, customer_email: customerEmail, customer_name: customerName }
            deliverVouchers(orderForDelivery, vouchers)
                .catch((err: any) => console.error('[RC Purchase] Delivery error:', err))
        }

        return NextResponse.json({
            success: true,
            isDuplicate: duplicate,
            order: {
                id:             order.id,
                reference_code: order.reference_code,
                type_name:      order.type_name,
                quantity:       order.quantity,
                unit_price:     order.unit_price,
                total_paid:     order.total_paid,
                status:         order.status,
            },
            vouchers,
            newBalance,
        })

    } catch (error: any) {
        switch (error?.message) {
            case 'INSUFFICIENT_BALANCE':
                return NextResponse.json({ error: 'Insufficient wallet balance. Please top up.' }, { status: 400 })
            case 'INSUFFICIENT_INVENTORY':
                return NextResponse.json({ error: 'Vouchers sold out. Please try again later.' }, { status: 400 })
            case 'RECENT_DUPLICATE':
                return NextResponse.json({ error: 'Duplicate order detected. Please wait 30 seconds before placing the same order again.', isDuplicate: true }, { status: 409 })
            case 'REFERENCE_IN_USE':
                return NextResponse.json({ error: 'This reference is already in use. Please try again.' }, { status: 409 })
            case 'VOUCHER_TYPE_NOT_FOUND':
                return NextResponse.json({ error: 'Voucher type not found or unavailable' }, { status: 404 })
            case 'WALLET_NOT_FOUND':
                return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
            case 'SUB_AGENT_PRICING_UNAVAILABLE':
                return NextResponse.json({ error: SUB_AGENT_PRICING_UNAVAILABLE_MESSAGE }, { status: SUB_AGENT_PRICING_UNAVAILABLE_STATUS })
        }
        console.error('[RC Purchase] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
