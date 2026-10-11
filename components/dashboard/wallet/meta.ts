import { getNetworkFromPrefix } from '@/lib/phone-validation'

export const QUICK_AMOUNTS = [50, 100, 200, 500]

// Background poll never gives up; after PATIENT_POLLS cycles (~1 min) the copy
// switches to a reassuring "tap I've paid / you'll be credited automatically".
export const PATIENT_POLLS = 6

/** Wrap fetch with an abort-based timeout so a dead socket surfaces an error
 * instead of hanging the (non-dismissible) payment modal forever on a transient
 * 'charging'/'verifying' state. On timeout the promise rejects with a friendly
 * message; callers turn that into a "Try Again" / keep-waiting outcome. */
export async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(input, { ...init, signal: controller.signal })
    } catch (err) {
        if (controller.signal.aborted) {
            throw new Error('Request timed out. Please check your connection and try again.')
        }
        throw err
    } finally {
        clearTimeout(timer)
    }
}

/** Paystack's mobile-money provider codes, in the order they're offered. The
 * icon key is what's handed to NetworkIcon — AirtelTigo has no airteltigo.png,
 * so 'ATL' rides NetworkIcon's "contains AT" fallback to at.png. */
export const WALLET_NETWORKS = [
    { code: 'MTN', label: 'MTN', dotColor: 'bg-yellow-400' },
    { code: 'VOD', label: 'Telecel', dotColor: 'bg-red-600' },
    { code: 'ATL', label: 'AirtelTigo', dotColor: 'bg-sky-600' },
] as const

export type WalletNetworkCode = (typeof WALLET_NETWORKS)[number]['code']

const LABEL_TO_PAYSTACK_CODE: Record<string, WalletNetworkCode> = {
    MTN: 'MTN',
    Telecel: 'VOD',
    AirtelTigo: 'ATL',
}

/** Detects the network from a 10-digit Ghana number's prefix, reusing the shared
 * prefix table in lib/phone-validation.ts rather than keeping a second copy. */
export function detectWalletNetwork(phone: string): WalletNetworkCode | null {
    if (phone.length < 3) return null
    const label = getNetworkFromPrefix(phone.slice(0, 3))
    return label ? (LABEL_TO_PAYSTACK_CODE[label] ?? null) : null
}

export function networkIconKey(code: WalletNetworkCode): string {
    return code === 'VOD' ? 'Telecel' : code
}

export interface MomoPaymentAccount {
    network: string
    number: string
}

export const NETWORK_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    'MTN Mobile Money': { bg: 'bg-yellow-400', text: 'text-yellow-950', label: 'MTN' },
    MTN: { bg: 'bg-yellow-400', text: 'text-yellow-950', label: 'MTN' },
    'Telecel Cash': { bg: 'bg-red-600', text: 'text-white', label: 'Telecel' },
    Telecel: { bg: 'bg-red-600', text: 'text-white', label: 'Telecel' },
    'AirtelTigo Money': { bg: 'bg-sky-600', text: 'text-white', label: 'AirtelTigo' },
    AirtelTigo: { bg: 'bg-sky-600', text: 'text-white', label: 'AirtelTigo' },
    Unknown: { bg: 'bg-gray-400', text: 'text-white', label: 'Unknown' },
}

export interface ClaimSuccessData {
    amount: number
    fee_percent: number
    fee_amount: number
    net_amount: number
    new_balance: number
    transaction_id: string
}

export type ChargeStep = 'idle' | 'charging' | 'otp_required' | 'pending' | 'verifying' | 'failed'
