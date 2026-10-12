// scripts/test-data-order-guards.ts
//
// The purchase routes must refuse a hand-made request that the dashboard would have stopped:
// a number on the wrong carrier, or a reference that is not the one the dashboard makes.
// Both would otherwise cost a supplier call and a refund, or let a member squat on a
// reference that belongs in another member's purchase.
import { recipientMatchesNetwork, toCanonicalPhone } from '@/lib/data-orders/phone'
import { isValidWebReference } from '@/lib/data-orders/place'
import { generateReferenceCode } from '@/lib/utils'

function check(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

// ── Recipient network ───────────────────────────────────────────────────────
check(recipientMatchesNetwork('0241234567', 'MTN'), true, 'MTN number, MTN bundle')
check(recipientMatchesNetwork('0551234567', 'MTN'), true, '055 is MTN')
check(recipientMatchesNetwork('0201234567', 'MTN'), false, 'Telecel number, MTN bundle')
check(recipientMatchesNetwork('0241234567', 'Telecel'), false, 'MTN number, Telecel bundle')
check(recipientMatchesNetwork('0201234567', 'Telecel'), true, 'Telecel number, Telecel bundle')
check(recipientMatchesNetwork('0501234567', 'Telecel'), true, '050 is Telecel')
check(recipientMatchesNetwork('0261234567', 'AT-iShare'), true, 'AirtelTigo number, AT iShare bundle')
check(recipientMatchesNetwork('0571234567', 'AT-iShare'), true, '057 is AirtelTigo')
check(recipientMatchesNetwork('0241234567', 'AT-iShare'), false, 'MTN number, AT iShare bundle')
// BigTime works on any number.
check(recipientMatchesNetwork('0241234567', 'AT-BigTime'), true, 'BigTime on MTN number')
check(recipientMatchesNetwork('0201234567', 'AT-BigTime'), true, 'BigTime on Telecel number')

// The canonical form is what gets checked, so every spelling gets the same answer.
check(recipientMatchesNetwork(toCanonicalPhone('+233 24 123 4567')!, 'MTN'), true, '+233 spelling')
check(recipientMatchesNetwork(toCanonicalPhone('233201234567')!, 'MTN'), false, '233 spelling, wrong carrier')

// ── Reference shape ─────────────────────────────────────────────────────────
// Whatever the dashboard generates must always be accepted.
for (let i = 0; i < 2000; i++) {
    const ref = generateReferenceCode()
    check(isValidWebReference(ref), true, `generated reference ${ref}`)
}
check(isValidWebReference('GHD-MGX1ABCD-1A2B3C4D'), true, 'well-formed')
check(isValidWebReference('GHD-MGX1ABCD-1A2B3C4D-0'), false, 'batch suffix is not a purchase reference')
check(isValidWebReference('ghd-mgx1abcd-1a2b3c4d'), false, 'lowercase')
check(isValidWebReference('AIR-MGX1ABCD-1A2B3C4D'), false, 'another table prefix')
check(isValidWebReference('GHD-1-1A2B3C4D'), false, 'timestamp too short')
check(isValidWebReference('GHD-MGX1ABCD-SHORT'), false, 'random part too short')
check(isValidWebReference('anything-the-member-likes'), false, 'free text')
check(isValidWebReference(''), false, 'empty')
check(isValidWebReference(undefined), false, 'undefined')
check(isValidWebReference(12345678), false, 'number')

console.log('data-order guards: ok')
