// Network prefixes for Ghanaian phone numbers
const NETWORK_PREFIXES: Record<string, string[]> = {
    'MTN': ['024', '025', '053', '054', '055', '059'],
    'Telecel': ['020', '050'],
    'AirtelTigo': ['026', '027', '056', '057'],
}

export interface PhoneValidationResult {
    isValid: boolean
    network: string | null
    normalizedNumber: string
    error?: string
}

export function validateGhanaianPhone(phone: string): PhoneValidationResult {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')

    // Handle international format (+233)
    if (cleaned.startsWith('233')) {
        cleaned = '0' + cleaned.slice(3)
    }

    // Must be exactly 10 digits
    if (cleaned.length !== 10) {
        return {
            isValid: false,
            network: null,
            normalizedNumber: '',
            error: 'Phone number must be 10 digits',
        }
    }

    // Must start with 0
    if (!cleaned.startsWith('0')) {
        return {
            isValid: false,
            network: null,
            normalizedNumber: '',
            error: 'Phone number must start with 0',
        }
    }

    // Detect network from prefix
    const prefix = cleaned.substring(0, 3)
    let detectedNetwork: string | null = null

    for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix)) {
            detectedNetwork = network
            break
        }
    }

    if (!detectedNetwork) {
        return {
            isValid: false,
            network: null,
            normalizedNumber: '',
            error: 'Invalid network prefix',
        }
    }

    return {
        isValid: true,
        network: detectedNetwork,
        normalizedNumber: cleaned,
    }
}

export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
    }
    return phone
}

export function toInternationalFormat(phone: string): string {
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
        cleaned = '233' + cleaned.slice(1)
    }
    return '+' + cleaned
}

export function detectNetwork(phone: string): string | null {
    const result = validateGhanaianPhone(phone)
    return result.network
}

export function getNetworkFromPrefix(prefix: string): string | null {
    for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
        if (prefixes.includes(prefix)) {
            return network
        }
    }
    return null
}

/** Collapse any of our network spellings (AT-iShare, AirtelTigo, Telecel...) to a carrier. */
export function carrierOf(network: string): 'MTN' | 'Telecel' | 'AirtelTigo' | null {
    const n = (network || '').trim().toUpperCase()
    if (n.startsWith('MTN')) return 'MTN'
    if (n.startsWith('TELECEL') || n.startsWith('VODAFONE')) return 'Telecel'
    if (n.startsWith('AT') || n.startsWith('AIRTEL')) return 'AirtelTigo'
    return null
}

export type RecipientNetworkCheck =
    | { ok: true; ported: boolean }
    | { ok: false; code: 'INVALID_PREFIX' | 'NETWORK_MISMATCH'; actualNetwork: string | null; message: string }

/**
 * Is `phone` fit to receive a `selectedNetwork` product?
 *  - A number whose prefix belongs to no Ghana network (MTN/Telecel/AT) is ALWAYS rejected.
 *  - A valid prefix on a different network is a mismatch, which ported numbers legitimately
 *    produce (Ghana has number portability), so it passes only if the buyer confirmed the
 *    number is ported (`portedConfirmed`).
 *  - AT-iShare and AT-BigTime are both AirtelTigo bundles, so they map to the AT prefixes.
 */
export function checkRecipientNetwork(
    phone: string,
    selectedNetwork: string,
    opts: { portedConfirmed?: boolean } = {},
): RecipientNetworkCheck {
    const v = validateGhanaianPhone(phone)
    if (!v.isValid) {
        return { ok: false, code: 'INVALID_PREFIX', actualNetwork: null, message: v.error === 'Invalid network prefix' ? 'This number does not belong to MTN, Telecel or AT. Check it and try again.' : 'Enter a valid 10-digit Ghana mobile number.' }
    }
    const expected = carrierOf(selectedNetwork)
    const actual = v.network as 'MTN' | 'Telecel' | 'AirtelTigo'
    if (!expected || expected === actual) return { ok: true, ported: false }
    if (opts.portedConfirmed) return { ok: true, ported: true }
    return { ok: false, code: 'NETWORK_MISMATCH', actualNetwork: actual, message: `This number looks like ${actual}, not ${selectedNetwork}. If it was ported to ${selectedNetwork}, confirm that to continue.` }
}

export function isValidPrefix(prefix: string): boolean {
    return Object.values(NETWORK_PREFIXES).flat().includes(prefix)
}

/**
 * Canonical 0XXXXXXXXX form. Strips spaces and a leading '+' so '+233...',
 * '233...' and '0...' all normalise to the same lookup form.
 */
export function normalizePhone(mobile: string): string {
    const clean = mobile.replace(/\s+/g, '').replace(/^\+/, '')
    if (clean.startsWith('233') && clean.length === 12) {
        return '0' + clean.slice(3)
    }
    return clean
}

/** Validate Ghana phone (0XXXXXXXXX or 233XXXXXXXXX, with optional +) */
export function isValidGhanaPhone(phone: string): boolean {
    const clean = phone.replace(/\s+/g, '').replace(/^\+/, '')
    return /^(0\d{9}|233\d{9})$/.test(clean)
}
