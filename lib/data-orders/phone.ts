import { validateGhanaianPhone } from '@/lib/phone-validation'

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

/** The spellings a number may have been stored under (blacklist rows were typed by hand). */
export function phoneLookupVariants(canonical: string): string[] {
    const intl = `233${canonical.slice(1)}`
    return [canonical, intl, `+${intl}`]
}
