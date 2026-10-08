// Pure-logic tests for lib/atishare-console-service.ts.
// Run: npx tsx scripts/test-atishare-console.ts
//
// WHY these specific cases:
//  - buildClientReference: SPFastIT returns the EXISTING transaction when a reference is
//    replayed. That is a safe recovery for a still-running order, but it means a FAILED
//    transaction replayed under the same reference stays failed forever. The suffix is keyed
//    on orders.retry_count (written ONLY by claim_order_retry), so a deliberate retry gets a
//    fresh reference while the re-fulfillment cron keeps replaying the same one.
//  - parseConsoleTimestamp: their timestamps carry NO timezone. A bare new Date() resolves
//    them against the process timezone, which would silently shift any freshness window.

import {
    buildClientReference, gbToMb, sizeToMb, normalizeConsolePhone,
    parseConsoleTimestamp, mapConsoleStatus, classifyConsoleFailure,
    assertAtIShareNetwork,
} from '../lib/atishare-console-service'

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

// ── client_reference ─────────────────────────────────────────────────────────
assertEqual(buildClientReference(OID, 0), `${OID}-r0`, 'attempt 0 → -r0 suffix')
assertEqual(buildClientReference(OID), `${OID}-r0`, 'attempt omitted → -r0')
assertEqual(buildClientReference(OID, 1), `${OID}-r1`, 'attempt 1 → -r1')
assertEqual(buildClientReference(OID, 3), `${OID}-r3`, 'attempt 3 → -r3')
assertEqual(new Set([0, 1, 2, 3].map(n => buildClientReference(OID, n))).size, 4, 'attempts 0..3 are 4 DISTINCT references')
assertEqual(buildClientReference(OID, -1), `${OID}-r0`, 'negative attempt → -r0, never -r-1')
assertEqual(buildClientReference(OID, NaN), `${OID}-r0`, 'NaN attempt → -r0')
assertEqual(buildClientReference(OID, 2.7), `${OID}-r2`, 'fractional attempt → floored')
assertEqual(buildClientReference(OID, Infinity), `${OID}-r0`, 'Infinity attempt → -r0')
assertEqual(buildClientReference(OID, 5).length <= 100, true, 'reference stays within their 100-char limit')
assertEqual(/^[A-Za-z0-9._:-]+$/.test(buildClientReference(OID, 5)), true, 'reference uses only their allowed characters')
assertEqual(buildClientReference(OID, 5).startsWith(OID), true, 'order id survives as a dash-delimited prefix')

// ── GB → MB (decimal, per their "1000MB = 1GB" note) ──────────────────────────
assertEqual(gbToMb(1), 1000, '1GB → 1000MB (not 1024)')
assertEqual(gbToMb(5), 5000, '5GB → 5000MB')
assertEqual(gbToMb(0.5), 500, '0.5GB → 500MB')
assertEqual(sizeToMb('1GB'), 1000, '"1GB" → 1000')
assertEqual(sizeToMb('15GB'), 15000, '"15GB" → 15000')
assertEqual(sizeToMb('2.5GB'), 2500, '"2.5GB" → 2500')
assertEqual(sizeToMb('bogus'), null, 'unparseable size → null, never a guess')

// ── Phone normalisation ─────────────────────────────────────────────────────
assertEqual(normalizeConsolePhone('0261234567'), '233261234567', 'local 0-prefixed → 233…')
assertEqual(normalizeConsolePhone('233261234567'), '233261234567', 'already 233 → unchanged')
assertEqual(normalizeConsolePhone('+233261234567'), '233261234567', '+233 → stripped')
assertEqual(normalizeConsolePhone('026 123 4567'), '233261234567', 'spaces stripped')

// ── Timestamps: MUST be parsed as UTC regardless of process TZ ────────────────
assertEqual(
    parseConsoleTimestamp('2026-07-21 21:45:30')?.toISOString(),
    '2026-07-21T21:45:30.000Z',
    'zone-less timestamp parsed as UTC'
)
assertEqual(
    parseConsoleTimestamp('2026-06-28T15:03:59Z')?.toISOString(),
    '2026-06-28T15:03:59.000Z',
    'explicit Z honoured'
)
assertEqual(parseConsoleTimestamp(''), null, 'empty timestamp → null')
assertEqual(parseConsoleTimestamp('not a date'), null, 'garbage timestamp → null')

// ── Status mapping: all seven documented statuses ──────────────────────────────
assertEqual(mapConsoleStatus('queued'), 'processing', 'queued → processing')
assertEqual(mapConsoleStatus('processing'), 'processing', 'processing → processing')
assertEqual(mapConsoleStatus('pending_retry'), 'processing', 'pending_retry → processing')
assertEqual(mapConsoleStatus('completed'), 'completed', 'completed → completed')
assertEqual(mapConsoleStatus('failed'), 'failed', 'failed → failed')
assertEqual(mapConsoleStatus('failed_blocked'), 'failed', 'failed_blocked → failed')
assertEqual(mapConsoleStatus('billed_failure'), 'failed', 'billed_failure → failed')
assertEqual(mapConsoleStatus('something_new'), 'processing', 'unknown status → processing, never a false terminal')

// ── Failure classification: NONE of the terminal failures trip the breaker ──
assertEqual(classifyConsoleFailure('failed'), { terminal: true, tripsBreaker: false }, 'failed: terminal, no breaker')
assertEqual(classifyConsoleFailure('failed_blocked'), { terminal: true, tripsBreaker: false }, 'failed_blocked: routine recipient rejection, no breaker')
assertEqual(classifyConsoleFailure('billed_failure'), { terminal: true, tripsBreaker: false }, 'billed_failure: terminal, no breaker')
assertEqual(classifyConsoleFailure('queued'), { terminal: false, tripsBreaker: false }, 'queued: not terminal')
assertEqual(classifyConsoleFailure('completed'), { terminal: true, tripsBreaker: false }, 'completed: terminal success')

// ── Network guard ────────────────────────────────────────────────────────────
assertEqual(assertAtIShareNetwork('AT-iShare'), true, 'AT-iShare accepted')
assertEqual(assertAtIShareNetwork('MTN'), false, 'MTN rejected')
assertEqual(assertAtIShareNetwork('Telecel'), false, 'Telecel rejected')
assertEqual(assertAtIShareNetwork('AT-BigTime'), false, 'AT-BigTime rejected — different product, same carrier')
assertEqual(assertAtIShareNetwork(''), false, 'empty network rejected')

console.log(failures === 0 ? '\nAll tests passed' : `\n${failures} test(s) failed`)
process.exit(failures > 0 ? 1 : 0)
