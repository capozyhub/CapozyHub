// Pure-logic tests for lib/spfastit-service.ts.
// Run: npx tsx scripts/test-spfastit-service.ts
//
// WHY these specific cases:
//  - buildSpfastitReference: no documented idempotency behavior on a repeated `reference`
//    exists for this supplier (unlike the AT-iShare Console, which explicitly recovers a
//    duplicate). Keying the suffix on orders.retry_count (written ONLY by claim_order_retry)
//    means the re-fulfillment cron always replays the SAME reference and a deliberate admin
//    retry always gets a NEW one — safe regardless of which way that untested behavior
//    resolves. See docs/superpowers/specs/2026-09-25-spfastit-telecel-supplier-design.md §7.
//  - mapSpfastitStatus: the only known real-world status values are admin-reported DASHBOARD
//    wording ("Not Served" / "WIP 2" / "Served" / "Failed"), not a captured API payload — the
//    exact-match on "served" (never .includes) is what stops "Not Served" colliding with it.
//  - sizeToMb: 1000-per-GB is a protocol-level fact (live-verified against a real /prices
//    call), never 1024 — but WHICH sizes actually sell is deliberately NOT this function's
//    call (platform-owner decision, 2026-09-27): it converts any parseable GB figure and lets
//    SPFastIT's own business-rejection response be the authority on what's sellable, so a
//    size the admin re-enables later (e.g. 5GB, if SPFastIT restores it) isn't blocked on our
//    side before ever reaching them.

import {
    sizeToMb, assertTelecelNetwork, buildSpfastitReference, mapSpfastitStatus,
    extractOrderIdFromReference, extractAttemptNoFromReference,
} from '../lib/spfastit-service'

let failures = 0
function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
        failures++
    } else {
        console.log(`PASS: ${label}`)
    }
}

const OID = '1be9997a-3c7b-40e7-8dd8-3c8c09bdf784'

// ─── size mapping ────────────────────────────────────────────────────────────
assertEqual(sizeToMb('10GB'), 10000, '"10GB" → 10000')
assertEqual(sizeToMb('15GB'), 15000, '"15GB" → 15000')
assertEqual(sizeToMb('50GB'), 50000, '"50GB" → 50000')
assertEqual(sizeToMb('100GB'), 100000, '"100GB" → 100000')
// No local allowlist — any parseable size converts and is sent on to SPFastIT, which is the
// one that decides (via a business rejection) whether it's actually sellable right now.
assertEqual(sizeToMb('5GB'), 5000, '"5GB" → 5000, converted even though not currently offered — SPFastIT rejects it if unsellable, we do not pre-block')
assertEqual(sizeToMb('1GB'), 1000, '"1GB" → 1000, converted (not our call whether it sells)')
assertEqual(sizeToMb('12GB'), 12000, '"12GB" → 12000, converted (not a round SPFastIT tier, still not our call to block)')
assertEqual(sizeToMb('2.5GB'), 2500, '"2.5GB" → 2500, decimal sizes still convert')
assertEqual(sizeToMb('bogus'), null, 'genuinely unparseable size → null')
assertEqual(sizeToMb('0GB'), null, 'zero is not a valid size → null')
assertEqual(sizeToMb('-5GB'), null, 'negative is not a valid size → null')
assertEqual(sizeToMb(''), null, 'empty string → null')

// ─── network guard ───────────────────────────────────────────────────────────
assertEqual(assertTelecelNetwork('Telecel'), true, 'Telecel accepted')
assertEqual(assertTelecelNetwork('MTN'), false, 'MTN rejected — pricing not competitive, out of scope')
assertEqual(assertTelecelNetwork('AT-iShare'), false, 'AT-iShare rejected — not offered by this supplier')
assertEqual(assertTelecelNetwork('AT-BigTime'), false, 'AT-BigTime rejected — not offered by this supplier')
assertEqual(assertTelecelNetwork(''), false, 'empty network rejected')

// ─── reference building ──────────────────────────────────────────────────────
assertEqual(buildSpfastitReference(OID, 0), `${OID}-r0`, 'attempt 0 → -r0 suffix')
assertEqual(buildSpfastitReference(OID), `${OID}-r0`, 'attempt omitted → -r0')
assertEqual(buildSpfastitReference(OID, 1), `${OID}-r1`, 'attempt 1 → -r1')
assertEqual(new Set([0, 1, 2, 3].map(n => buildSpfastitReference(OID, n))).size, 4, 'attempts 0..3 are 4 DISTINCT references')
assertEqual(buildSpfastitReference(OID, -1), `${OID}-r0`, 'negative attempt → -r0, never -r-1')
assertEqual(buildSpfastitReference(OID, NaN), `${OID}-r0`, 'NaN attempt → -r0')
assertEqual(buildSpfastitReference(OID, 2.7), `${OID}-r2`, 'fractional attempt → floored')

// ─── recovering the order id from our own reference ───────────────────────────
assertEqual(extractOrderIdFromReference(`${OID}-r0`), OID, 'plain reference recovers the order id')
assertEqual(extractOrderIdFromReference(`${OID}-r3`), OID, 'retried reference recovers the order id')
assertEqual(extractOrderIdFromReference('not-a-reference'), null, 'garbage reference → null')
assertEqual(extractOrderIdFromReference(''), null, 'empty reference → null')

// ─── recovering the attempt number from our own reference (webhook stale-attempt guard) ──
assertEqual(extractAttemptNoFromReference(`${OID}-r0`), 0, 'attempt 0 reference → 0')
assertEqual(extractAttemptNoFromReference(`${OID}-r1`), 1, 'attempt 1 reference → 1')
assertEqual(extractAttemptNoFromReference(`${OID}-r12`), 12, 'multi-digit attempt → 12')
assertEqual(extractAttemptNoFromReference('not-a-reference'), null, 'garbage reference → null')
assertEqual(extractAttemptNoFromReference(''), null, 'empty reference → null')

// ─── status mapping ──────────────────────────────────────────────────────────
assertEqual(mapSpfastitStatus('Served'), 'completed', '"Served" → completed')
assertEqual(mapSpfastitStatus('served'), 'completed', 'lowercase "served" → completed')
assertEqual(mapSpfastitStatus('Failed'), 'failed', '"Failed" → failed')
assertEqual(mapSpfastitStatus('Not Served'), 'processing', '"Not Served" → processing, NOT completed (must not match on the "served" substring)')
assertEqual(mapSpfastitStatus('not-served'), 'processing', 'live-verified 2026-09-26: real Place Order order_status value is "not-served" (lowercase, hyphenated) → processing')
assertEqual(mapSpfastitStatus('WIP 2'), 'processing', '"WIP 2" → processing')
assertEqual(mapSpfastitStatus('WIP 1'), 'processing', 'any numbered WIP stage → processing')
assertEqual(mapSpfastitStatus('wip'), 'processing', 'bare "wip" → processing')
assertEqual(mapSpfastitStatus('initiated'), 'processing', 'docs\' "initiated" value also maps to processing')
assertEqual(mapSpfastitStatus('completed'), 'completed', 'docs\' "completed" value also maps to completed')
assertEqual(mapSpfastitStatus('something_unrecognized'), 'processing', 'unrecognized status → processing, never a false success or failure')
assertEqual(mapSpfastitStatus(''), 'processing', 'empty status → processing')

console.log(failures === 0 ? '\nAll tests passed' : `\n${failures} test(s) failed`)
process.exit(failures > 0 ? 1 : 0)
