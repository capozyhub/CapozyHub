import type { BundlePreference } from '@/lib/mashup-bundle'

export type AirtimeNetwork = 'MTN' | 'Telecel' | 'AT'
export type PurchaseMode = 'airtime' | 'mashup'

export const AIRTIME_NETWORKS: { id: AirtimeNetwork; label: string; color: string }[] = [
    { id: 'MTN', label: 'MTN', color: '#FFCC00' },
    { id: 'Telecel', label: 'Telecel', color: '#E60000' },
    { id: 'AT', label: 'AT', color: '#0057B8' },
]

export const QUICK_AMOUNTS = [1, 2, 5, 10, 20, 50]

/** phone-validation names the AT carrier "AirtelTigo"; airtime orders call it "AT". */
export function carrierToNetwork(carrier: string | null | undefined): AirtimeNetwork | null {
    if (carrier === 'MTN') return 'MTN'
    if (carrier === 'Telecel') return 'Telecel'
    if (carrier === 'AirtelTigo') return 'AT'
    return null
}

/** A row from /api/airtime/history, or the order a purchase just created. */
export interface AirtimeOrder {
    id: string
    reference_code: string
    network: string
    beneficiary_phone: string
    airtime_amount: number
    fee_amount: number
    total_paid: number
    status: string
    created_at: string
    type?: PurchaseMode
    bundle_preference?: BundlePreference | null
}
