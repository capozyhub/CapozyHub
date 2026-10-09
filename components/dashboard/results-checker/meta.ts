import { getResultsCheckerPortal } from '@/lib/results-checker-utils'

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

/** At or below this many left, an exam is flagged as running low. */
export const LOW_STOCK = 10

/** A short headline for an exam: "WASSCE School Candidate Checker" becomes "WASSCE". */
export function examLabel(name: string): string {
    const n = name.toUpperCase()
    if (n.includes('BECE')) return 'BECE'
    if (n.includes('WASSCE') || n.includes('WAEC')) return 'WASSCE'
    if (n.includes('NOV') && n.includes('DEC')) return 'NOV/DEC'
    return name.split(/\s+/)[0] || name
}

/** The website where this exam's results are checked, or null when we don't know it. */
export function portalHost(typeName: string): string | null {
    const p = getResultsCheckerPortal(typeName)
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p) ? p : null
}

/** The first bulk tier above `quantity`, so the page can say what buying a few more would save. */
export function nextBulkTier(type: RCType, quantity: number) {
    return (type.bulk_pricing ?? [])
        .filter(t => t.min_qty > quantity && t.unit_price < type.price)
        .sort((a, b) => a.min_qty - b.min_qty)[0] ?? null
}

/** The cheapest per-voucher bulk price, for the "from" line on an exam tile. */
export function lowestBulkPrice(type: RCType): number | null {
    const prices = (type.bulk_pricing ?? []).map(t => t.unit_price).filter(p => p < type.price)
    return prices.length ? Math.min(...prices) : null
}

/** What can be bought now: never more than the stock on hand or the admin maximum. */
export function maxQuantityFor(type: RCType | undefined, adminMax: number): number {
    return type ? Math.max(1, Math.min(adminMax, type.available_count)) : adminMax
}

export function voucherText(vouchers: Voucher[]): string {
    return vouchers.map((v, i) => `Voucher ${i + 1}\nSerial: ${v.serial_number}\nPIN: ${v.pin}`).join('\n\n')
}