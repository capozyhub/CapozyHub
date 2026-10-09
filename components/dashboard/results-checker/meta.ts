export interface RCType {
    id: string
    name: string
    /** Per-voucher price for this member (role- and sub-agent-adjusted by the server). */
    price: number
    available_count: number
    bulk_pricing?: Array<{ min_qty: number; max_qty: number; unit_price: number }>
    /** Sub-agents only: false means no price is set for them on this type yet. */
    configured?: boolean
}

export interface RCOrder {
    id: string
    reference_code: string
    type_name: string
    quantity: number
    unit_price: number
    total_paid: number
    status: string
    created_at: string
    inventory_ids: string[] | null
    results_checker_complaints?: { id: string; status: string }[]
}

export type Voucher = { pin: string; serial_number: string }

/** The bulk tier a quantity falls in, if any. */
export function bulkTierFor(type: RCType, quantity: number) {
    return type.bulk_pricing?.find(t => quantity >= t.min_qty && quantity <= t.max_qty) ?? null
}

/** Per-voucher price for this quantity. The server re-prices everything; this only previews it. */
export function unitPriceFor(type: RCType, quantity: number): number {
    return bulkTierFor(type, quantity)?.unit_price ?? type.price
}

/** What can be bought now: never more than the stock on hand or the admin maximum. */
export function maxQuantityFor(type: RCType | undefined, adminMax: number): number {
    return type ? Math.max(1, Math.min(adminMax, type.available_count)) : adminMax
}