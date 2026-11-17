import { validateGhanaianPhone } from '@/lib/phone-validation'

/**
 * Server-side check of the MoMo wallet being charged, shared by every Paystack charge route.
 *
 * `selected` is whatever the client sent: a storefront label (MTN | Telecel | AT) or a Paystack
 * code (MTN | VOD | ATL). Rules:
 *  - a number whose prefix is on no Ghana network is always rejected;
 *  - no selection -> the provider is detected from the prefix;
 *  - a selection that contradicts the prefix is rejected unless the payer confirmed the
 *    number was ported (`portedConfirmed`) -- Ghana has number portability.
 */
export type MomoProvider = 'MTN' | 'VOD' | 'ATL'

const SELECTED_TO_PROVIDER: Record<string, MomoProvider> = {
    MTN: 'MTN', Telecel: 'VOD', AT: 'ATL', VOD: 'VOD', ATL: 'ATL',
}
const CARRIER_TO_PROVIDER: Record<string, MomoProvider> = { MTN: 'MTN', Telecel: 'VOD', AirtelTigo: 'ATL' }
const PROVIDER_LABEL: Record<MomoProvider, string> = { MTN: 'MTN', VOD: 'Telecel', ATL: 'AT' }

export type MomoWalletResult =
    | { ok: true; phone: string; provider: MomoProvider }
    | { ok: false; status: 400; error: string; code: 'INVALID_PREFIX' | 'NETWORK_MISMATCH'; actualNetwork: string | null }

export function resolveMomoWallet(rawPhone: unknown, selected: unknown, portedConfirmed: unknown): MomoWalletResult {
    const text = typeof rawPhone === 'string' ? rawPhone : ''
    const v = validateGhanaianPhone(text)
    if (!v.isValid) {
        return {
            ok: false, status: 400, code: 'INVALID_PREFIX', actualNetwork: null,
            error: 'This mobile money number does not belong to MTN, Telecel or AT. Check it and try again.',
        }
    }
    const detected = CARRIER_TO_PROVIDER[v.network as string]
    const picked = typeof selected === 'string' && selected.length <= 12 ? SELECTED_TO_PROVIDER[selected] : undefined
    if (!picked || picked === detected) return { ok: true, phone: v.normalizedNumber, provider: detected }
    if (portedConfirmed === true) return { ok: true, phone: v.normalizedNumber, provider: picked }
    return {
        ok: false, status: 400, code: 'NETWORK_MISMATCH', actualNetwork: v.network,
        error: `This number looks like ${v.network}, not ${PROVIDER_LABEL[picked]}. If it was ported to ${PROVIDER_LABEL[picked]}, confirm that to continue.`,
    }
}
