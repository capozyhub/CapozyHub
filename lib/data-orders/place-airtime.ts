export interface AirtimeOrderInput {
    reference_code: string
    /** Canonical 0XXXXXXXXX (see toCanonicalPhone). */
    beneficiary_phone: string
    network: 'MTN' | 'Telecel' | 'AT'
    type: 'airtime' | 'mashup'
    bundle_preference: 'balanced' | 'data' | 'voice' | null
    /** What the beneficiary receives, decided server-side. */
    airtime_amount: number
    fee_rate: number
    fee_amount: number
    /** What the wallet is debited, decided server-side. */
    total_paid: number
    use_exact_amount: boolean
    user_role: string
    source: 'web' | 'api'
    api_key_id?: string | null
}

export interface PlacedAirtimeOrder {
    id: string
    reference_code: string
    status: string
    network: string
    beneficiary_phone: string
    airtime_amount: number
    total_paid: number
}

export type PlaceAirtimeResult =
    | { ok: true; duplicate: true; order: PlacedAirtimeOrder }
    | { ok: true; duplicate: false; walletId: string; newBalance: number; order: PlacedAirtimeOrder }
    | { ok: false; code: 'INSUFFICIENT_BALANCE' | 'RECENT_DUPLICATE' | 'REFERENCE_IN_USE' | 'NO_WALLET' | 'INVALID' | 'FAILED'; message: string }

function toOrder(raw: any): PlacedAirtimeOrder {
    return {
        id: raw.id,
        reference_code: raw.reference_code,
        status: raw.status,
        network: raw.network,
        beneficiary_phone: raw.beneficiary_phone,
        airtime_amount: Number(raw.airtime_amount),
        total_paid: Number(raw.total_paid),
    }
}

/**
 * Buys airtime or a Mashup bundle in one database transaction (place_airtime_order): wallet
 * debit, order row and ledger row are written together or not at all, so a failure never
 * needs a refund. A reference this member already used comes back as a duplicate of that order.
 */
export async function placeAirtimeOrder(
    supabase: any,
    userId: string,
    input: AirtimeOrderInput,
    dedupeSeconds = 30,
): Promise<PlaceAirtimeResult> {
    const { data, error } = await supabase.rpc('place_airtime_order', {
        p_user_id: userId,
        p_order: input,
        p_dedupe_seconds: dedupeSeconds,
    })

    if (error) {
        const text = `${error.message ?? ''} ${error.details ?? ''}`
        if (text.includes('INSUFFICIENT_BALANCE')) return { ok: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance' }
        if (text.includes('RECENT_DUPLICATE')) return { ok: false, code: 'RECENT_DUPLICATE', message: 'Duplicate order detected. Please wait 30 seconds before placing the same order again.' }
        if (text.includes('WALLET_NOT_FOUND')) return { ok: false, code: 'NO_WALLET', message: 'Wallet not found' }
        if (text.includes('INVALID_INPUT')) return { ok: false, code: 'INVALID', message: 'Invalid order' }
        // airtime_orders.reference_code is globally unique: this reference belongs to someone else.
        if (error.code === '23505' || text.includes('duplicate key')) {
            return { ok: false, code: 'REFERENCE_IN_USE', message: 'This reference is already in use' }
        }
        console.error('[airtime] place_airtime_order failed:', error)
        return { ok: false, code: 'FAILED', message: 'Failed to process payment' }
    }

    if (!data?.order?.id) {
        console.error('[airtime] place_airtime_order returned an unexpected shape:', data)
        return { ok: false, code: 'FAILED', message: 'Failed to process payment' }
    }
    if (data.duplicate) return { ok: true, duplicate: true, order: toOrder(data.order) }
    if (!data.wallet_id) {
        console.error('[airtime] place_airtime_order returned no wallet:', data)
        return { ok: false, code: 'FAILED', message: 'Failed to process payment' }
    }
    return { ok: true, duplicate: false, walletId: data.wallet_id, newBalance: Number(data.new_balance), order: toOrder(data.order) }
}
