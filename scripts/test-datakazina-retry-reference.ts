// Pure-logic tests for buildIncomingApiRef / buildDataPackageRequestBody
// (lib/datakazina-request.ts) and the webhook's order-id recovery.
// Run: npx tsx scripts/test-datakazina-retry-reference.ts
//
// WHY: DataKazina permanently records incoming_api_ref and rejects any resubmission with
// HTTP 422 "Duplicate order reference detected" — even when their OWN earlier attempt failed
// (confirmed 2026-08-20 against their dashboard). Because the reference used to be the bare
// order id, an admin retry of a failed order resubmitted the identical reference and was
// rejected forever, so the order could never be fulfilled by DataKazina again.
//
// The suffix is keyed on orders.retry_count, which is written ONLY by the claim_order_retry
// RPC. That is what makes this safe:
//   - the re-fulfillment cron re-dispatching a pending order does NOT touch retry_count, so
//     it keeps sending the SAME reference and DataKazina's duplicate guard still stops the
//     cron creating a new supplier order every couple of minutes;
//   - a deliberate retry DOES increment it, so it sends a NEW reference and is accepted.

import { buildIncomingApiRef, buildDataPackageRequestBody } from '../lib/datakazina-request'

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

// ── Backwards compatibility: attempt 0 must be byte-identical to the old behaviour ──
// All 1,893 already-dispatched orders were sent as the bare id; nothing may change shape.
assertEqual(buildIncomingApiRef(OID, 0), OID, 'attemptNo 0 → bare order id (unchanged from original)')
assertEqual(buildIncomingApiRef(OID, undefined), OID, 'attemptNo undefined → bare order id')
assertEqual(buildIncomingApiRef(OID), OID, 'attemptNo omitted → bare order id')

// ── Deliberate retries get a distinct reference ──────────────────────────────
assertEqual(buildIncomingApiRef(OID, 1), `${OID}-r1`, 'attemptNo 1 → "-r1" suffix')
assertEqual(buildIncomingApiRef(OID, 2), `${OID}-r2`, 'attemptNo 2 → "-r2" suffix')
assertEqual(buildIncomingApiRef(OID, 7), `${OID}-r7`, 'attemptNo 7 → "-r7" suffix')

// Each attempt must differ from every other — that is the entire point.
const refs = [0, 1, 2, 3].map(n => buildIncomingApiRef(OID, n))
assertEqual(new Set(refs).size, 4, 'attempts 0..3 produce 4 DISTINCT references')

// ── Defensive: never emit a malformed suffix ────────────────────────────────
assertEqual(buildIncomingApiRef(OID, -1), OID, 'negative attemptNo → bare id, never "-r-1"')
assertEqual(buildIncomingApiRef(OID, NaN), OID, 'NaN attemptNo → bare id')
assertEqual(buildIncomingApiRef(OID, 2.7), `${OID}-r2`, 'fractional attemptNo → floored, no decimal in ref')
assertEqual(buildIncomingApiRef(OID, Infinity), OID, 'Infinity attemptNo → bare id')

// ── The full request body ───────────────────────────────────────────────────
const base = { normalizedPhone: '0559651777', networkId: 3, volumeNumber: 1, orderId: OID }
assertEqual(
    buildDataPackageRequestBody(base),
    { recipient_msisdn: '0559651777', network_id: 3, shared_bundle: 1, incoming_api_ref: OID },
    'body with no attemptNo → original shape exactly'
)
assertEqual(
    buildDataPackageRequestBody({ ...base, attemptNo: 2 }).incoming_api_ref,
    `${OID}-r2`,
    'body with attemptNo 2 → retry-suffixed incoming_api_ref'
)
// dispatchKey must never leak into the reference — the webhook has to recover the order id.
assertEqual(
    buildDataPackageRequestBody({ ...base, dispatchKey: 'some:composite:key' }).incoming_api_ref,
    OID,
    'dispatchKey is ignored for incoming_api_ref (webhook must be able to recover the order id)'
)

// ── The order id must remain recoverable from every reference we emit ───────
// Mirrors extractOrderIdCandidates in app/api/webhooks/dakazina/route.ts: the order id is
// the leading 32 hex chars once dashes are stripped. If this ever stops holding, a retried
// order's webhook can no longer be resolved.
function leadingUuid(ref: string): string | null {
    const hexOnly = ref.replace(/-/g, '').toLowerCase()
    const m = hexOnly.match(/^([0-9a-f]{32})/)
    if (!m) return null
    const h = m[1]
    return `${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20, 32)}`
}
for (const n of [0, 1, 2, 9]) {
    assertEqual(leadingUuid(buildIncomingApiRef(OID, n)), OID, `order id recoverable from the attempt-${n} reference`)
}

if (failures > 0) {
    console.error(`\n${failures} test(s) failed.`)
    process.exit(1)
}
console.log('\nAll tests passed.')
