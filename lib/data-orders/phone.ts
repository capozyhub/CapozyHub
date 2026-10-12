import { getNetworkFromPrefix, validateGhanaianPhone } from '@/lib/phone-validation'

/**
 * One canonical form for every recipient number: 0XXXXXXXXX, with a real Ghana mobile prefix.
 * '+233 24 123 4567', '233241234567' and '024 123 4567' all come back as '0241234567';
 * anything that isn't a plausible mobile number comes back as null.
 *
 * Checks, blacklist lookups, the order row and the supplier call must all use this one form,
 * otherwise the same number can slip past a check by being written differently.
 */
export function toCanonicalPhone(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (trimmed.length === 0 || trimmed.length > 20) return null
    // Digits plus the separators people actually type. No letters or symbols smuggled in.
    if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return null
    const res = validateGhanaianPhone(trimmed)
    return res.isValid ? res.normalizedNumber : null
}

/**
 * Is this canonical number on the carrier a bundle is for? MTN, Telecel and AT iShare bundles
 * only work on their own carrier's numbers; AT BigTime works on any number. The dashboard
 * checks this as you type, but a hand-made request skips the dashboard, so the purchase
 * routes check it too: a mismatched order would only fail at the supplier and need a refund.
 */
export function recipientMatchesNetwork(canonical: string, packageNetwork: string): boolean {
    if (packageNetwork === 'AT-BigTime') return true
    const carrier = getNetworkFromPrefix(canonical.slice(0, 3))
    const expected = packageNetwork.startsWith('AT') ? 'AirtelTigo' : packageNetwork
    return carrier === expected
}

/** The spellings a number may have been stored under (blacklist rows were typed by hand). */
export function phoneLookupVariants(canonical: string): string[] {
    const intl = `233${canonical.slice(1)}`
    return [canonical, intl, `+${intl}`]
}
