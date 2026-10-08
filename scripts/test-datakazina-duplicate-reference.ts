// Pure-logic tests for isDuplicateReferenceRejection (lib/datakazina-request.ts).
// Run: npx tsx scripts/test-datakazina-duplicate-reference.ts
//
// Why this rule matters: buildDataPackageRequestBody always sends the PLAIN order id as
// incoming_api_ref, so DataKazina rejecting it as a duplicate proves this same order was
// already submitted to them — possibly already delivered and charged. Misclassifying that as
// an ordinary failure reverts the order to 'pending', lets the cron re-dispatch it forever,
// and leaves it eligible for the fallback engine to route to a DIFFERENT supplier that knows
// nothing about DataKazina's reference — delivering it twice. Confirmed live 2026-08-20.

import { isDuplicateReferenceRejection } from '../lib/datakazina-request'

let failures = 0
function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`)
        failures++
    } else {
        console.log(`PASS: ${label}`)
    }
}

// ── The exact live response observed 2026-08-20 ──────────────────────────────
const LIVE_DUPLICATE_BODY = {
    message: 'Duplicate order reference detected.',
    errors: { incoming_api_ref: ['Duplicate order reference detected.'] },
}
assertEqual(
    isDuplicateReferenceRejection(422, LIVE_DUPLICATE_BODY),
    true,
    'live 422 duplicate body (structured errors.incoming_api_ref) → true'
)

// ── Structured path: field error present, regardless of message wording ──────
assertEqual(
    isDuplicateReferenceRejection(422, { errors: { incoming_api_ref: ['anything at all'] } }),
    true,
    'structured errors.incoming_api_ref present, no message → true'
)
assertEqual(
    isDuplicateReferenceRejection(422, { message: 'Some reworded duplicate error', errors: { incoming_api_ref: [] } }),
    true,
    'structured field present but empty array → true (presence is the signal, not contents)'
)

// ── Secondary net: message names a duplicate, no structured field ────────────
assertEqual(
    isDuplicateReferenceRejection(422, { message: 'Duplicate order reference detected.' }),
    true,
    'message-only duplicate (structured field absent) → true via secondary net'
)
assertEqual(
    isDuplicateReferenceRejection(422, { message: 'DUPLICATE REFERENCE' }),
    true,
    'message match is case-insensitive → true'
)

// ── Must NOT fire: other 422 validation failures ────────────────────────────
// These are genuine failures that SHOULD revert to pending and retry normally. Treating one
// as a duplicate would park a retryable order in 'processing' awaiting a human.
assertEqual(
    isDuplicateReferenceRejection(422, { message: 'The recipient msisdn field is required.', errors: { recipient_msisdn: ['required'] } }),
    false,
    'unrelated 422 validation error (different field) → false'
)
assertEqual(
    isDuplicateReferenceRejection(422, { message: 'Insufficient balance' }),
    false,
    '422 with an unrelated message → false'
)

// ── Must NOT fire: wrong status code ────────────────────────────────────────
assertEqual(
    isDuplicateReferenceRejection(200, LIVE_DUPLICATE_BODY),
    false,
    'HTTP 200 → false even with a duplicate-shaped body (only 422 carries this rejection)'
)
assertEqual(
    isDuplicateReferenceRejection(500, LIVE_DUPLICATE_BODY),
    false,
    'HTTP 500 → false — a real instability signal must still trip the breaker'
)
assertEqual(
    isDuplicateReferenceRejection(429, LIVE_DUPLICATE_BODY),
    false,
    'HTTP 429 → false — handled separately as a rate limit'
)

// ── Malformed / defensive ───────────────────────────────────────────────────
assertEqual(isDuplicateReferenceRejection(422, null), false, 'null body → false, no throw')
assertEqual(isDuplicateReferenceRejection(422, undefined), false, 'undefined body → false, no throw')
assertEqual(isDuplicateReferenceRejection(422, 'a string'), false, 'non-object body → false, no throw')
assertEqual(isDuplicateReferenceRejection(422, {}), false, 'empty object → false')
assertEqual(
    isDuplicateReferenceRejection(422, { errors: 'not-an-object' }),
    false,
    'errors present but not an object → false, no throw'
)
assertEqual(
    isDuplicateReferenceRejection(422, { message: 12345 }),
    false,
    'non-string message → false, no throw'
)

if (failures > 0) {
    console.error(`\n${failures} test(s) failed.`)
    process.exit(1)
}
console.log('\nAll tests passed.')
