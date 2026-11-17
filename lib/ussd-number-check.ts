import { checkRecipientNetwork, validateGhanaianPhone, carrierOf } from '@/lib/phone-validation'

/**
 * Number checks for the USSD channel. USSD has no checkboxes or error pages: a session is a
 * short text menu, so this returns a ready-to-show message and says which step comes next.
 * Wire it into every USSD purchase step (data, airtime, mashup, results checker, AFA) and the
 * same rules as the web storefront apply without re-implementing them:
 *
 *   const r = checkUssdRecipient(input, 'AT-BigTime')
 *   if (r.status === 'invalid')  -> show r.message, ask for the number again
 *   if (r.status === 'confirm')  -> show r.message ("1. Yes, it is ported  2. No"); on "1" call
 *                                   again with { portedConfirmed: true }
 *   if (r.status === 'ok')       -> r.phone is the canonical 0XXXXXXXXX number to order for
 *
 * Pass `network: null` for products that are not tied to a network (results checker vouchers,
 * AFA): only the prefix is checked.
 */
export type UssdNumberCheck =
    | { status: 'ok'; phone: string; ported: boolean }
    | { status: 'invalid'; message: string }
    | { status: 'confirm'; message: string; actualNetwork: string }

export function checkUssdRecipient(
    rawInput: string,
    network: string | null,
    opts: { portedConfirmed?: boolean } = {},
): UssdNumberCheck {
    const v = validateGhanaianPhone(String(rawInput ?? ''))
    if (!v.isValid) {
        return {
            status: 'invalid',
            message: v.error === 'Invalid network prefix'
                ? 'That number is not MTN, Telecel or AT. Enter it again.'
                : 'Enter a valid 10-digit number, e.g. 0241234567.',
        }
    }
    if (!network || !carrierOf(network)) return { status: 'ok', phone: v.normalizedNumber, ported: false }

    const r = checkRecipientNetwork(v.normalizedNumber, network, opts)
    if (r.ok) return { status: 'ok', phone: v.normalizedNumber, ported: r.ported }
    if (r.code === 'INVALID_PREFIX') return { status: 'invalid', message: r.message }
    return { status: 'confirm', actualNetwork: r.actualNetwork ?? '', message: `${v.normalizedNumber} looks like ${r.actualNetwork}, not ${network.replace('AT-', 'AT ')}. Was it ported?` }
}
