export interface PlaceItem {
    reference_code: string
    /** Canonical 0XXXXXXXXX (see toCanonicalPhone). */
    phone_number: string
    network: string
    size: string
    /** What the buyer is charged, decided server-side. */
    price: number
    cost_price: number
    role_at_time: string
    status: 'pending' | 'queued'
    fulfillment_method: 'auto' | 'manual'
    category: string
    source?: 'web' | 'api'
    api_key_id?: string | null
}

export interface PlacedOrder {
    id: string
    reference_code: string
    status: string
    network: string
    size: string
    phone_number: string
}

export type PlaceResult =
    | { ok: true; duplicate: true }
    | { ok: true; duplicate: false; walletId: string; newBalance: number; total: number; orders: PlacedOrder[] }
    | { ok: false; code: 'INSUFFICIENT_BALANCE' | 'REFERENCE_IN_USE' | 'INVALID' | 'FAILED'; message: string }

/**
 * Buys the whole batch in one database transaction (place_data_orders): wallet debit, order
 * rows and ledger rows are written together or not at all. Nothing here ever needs to
 * "refund after a failed insert", because a failure leaves the wallet exactly as it was.
 */
export async function placeDataOrders(supabase: any, userId: string, items: PlaceItem[]): Promise<PlaceResult> {
    const { data, error } = await supabase.rpc('place_data_orders', { p_user_id: userId, p_orders: items })

    if (error) {
        const text = `${error.message ?? ''} ${error.details ?? ''}`
        if (text.includes('INSUFFICIENT_BALANCE')) {
            return { ok: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance' }
        }
        if (text.includes('INVALID_INPUT')) {
            return { ok: false, code: 'INVALID', message: 'Invalid order' }
        }
        // orders.reference_code is globally unique: this reference belongs to someone else.
        if (error.code === '23505' || text.includes('duplicate key')) {
            return { ok: false, code: 'REFERENCE_IN_USE', message: 'This reference is already in use' }
        }
        console.error('[data-orders] place_data_orders failed:', error)
        return { ok: false, code: 'FAILED', message: 'Failed to process payment' }
    }

    if (data?.duplicate) return { ok: true, duplicate: true }
    if (!data?.wallet_id || !Array.isArray(data.orders)) {
        console.error('[data-orders] place_data_orders returned an unexpected shape:', data)
        return { ok: false, code: 'FAILED', message: 'Failed to process payment' }
    }

    return {
        ok: true,
        duplicate: false,
        walletId: data.wallet_id,
        newBalance: Number(data.new_balance),
        total: Number(data.total),
        orders: data.orders as PlacedOrder[],
    }
}

/** A client-supplied idempotency key: short, URL-safe, nothing that could be abused as a payload. */
export function isValidClientReference(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_\-]{6,97}$/.test(value)
}
