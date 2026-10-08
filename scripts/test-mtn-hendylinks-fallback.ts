import { isFallbackWorthyRejection, resolveFallbackSupplier } from '../lib/mtn-hendylinks-fallback'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
        console.error(`FAIL: ${label} — expected ${e}, got ${a}`)
        process.exitCode = 1
    } else {
        console.log(`PASS: ${label}`)
    }
}

// ── isFallbackWorthyRejection ───────────────────────────────────────────────
assertEqual(
    isFallbackWorthyRejection('MTN', { _httpStatus: 404 }),
    true,
    'MTN + HTTP 404 → true'
)
// 403 = "Recipient phone number is not a verified beneficiary" — the direct analogue of
// CodeCraft's 422 and AgentPortal's whitelist rejection, and the single most common reason
// an MTN order needs rerouting. Confirmed from a live rejection 2026-08-20; the original
// implementation only handled 404, so this fallback never fired for the case it exists for.
assertEqual(
    isFallbackWorthyRejection('MTN', { _httpStatus: 403 }),
    true,
    'MTN + HTTP 403 (unverified beneficiary) → true — the case this fallback exists for'
)
assertEqual(
    isFallbackWorthyRejection('Telecel', { _httpStatus: 403 }),
    false,
    'non-MTN network + 403 → false (MTN-only, same as every other fallback module)'
)
assertEqual(
    isFallbackWorthyRejection('Telecel', { _httpStatus: 404 }),
    false,
    'non-MTN network → false even with matching status'
)
// Guards the ambiguous-outcome contract: hendylinks-service attaches _httpStatus ONLY on a
// definite rejection, never on ambiguous. A non-numeric/absent value must never route an
// order HendyLinks may already have charged to a second supplier.
assertEqual(
    isFallbackWorthyRejection('MTN', { _httpStatus: '403' }),
    false,
    'MTN + _httpStatus as a STRING → false (never coerce; ambiguous outcomes carry no status)'
)
assertEqual(
    isFallbackWorthyRejection('MTN', { _httpStatus: 402 }),
    false,
    'MTN + HTTP 402 (insufficient balance) → false — explicitly excluded per user decision'
)
assertEqual(
    isFallbackWorthyRejection('MTN', { _httpStatus: 400 }),
    false,
    'MTN + HTTP 400 → false'
)
assertEqual(
    isFallbackWorthyRejection('MTN', { _httpStatus: 401 }),
    false,
    'MTN + HTTP 401 → false'
)
assertEqual(
    isFallbackWorthyRejection('MTN', undefined),
    false,
    'MTN + missing apiResponse → false'
)
assertEqual(
    isFallbackWorthyRejection('MTN', {}),
    false,
    'MTN + apiResponse with no _httpStatus field → false'
)

// ── resolveFallbackSupplier ─────────────────────────────────────────────────
assertEqual(resolveFallbackSupplier('none'), null, "'none' setting value → null (no fallback)")
assertEqual(resolveFallbackSupplier('datakazina'), 'datakazina', "'datakazina' setting value → 'datakazina'")
assertEqual(resolveFallbackSupplier('codecraft'), 'codecraft', "'codecraft' setting value → 'codecraft'")
assertEqual(resolveFallbackSupplier('xpress'), 'xpress', "'xpress' setting value → 'xpress'")
assertEqual(resolveFallbackSupplier('ghdata'), 'ghdata', "'ghdata' setting value → 'ghdata'")
assertEqual(resolveFallbackSupplier('agentportal'), 'agentportal', "'agentportal' setting value → 'agentportal'")
assertEqual(resolveFallbackSupplier('bundleportal'), 'bundleportal', "'bundleportal' setting value → 'bundleportal'")
assertEqual(resolveFallbackSupplier('hendylinks'), null, "'hendylinks' itself → null (cannot fall back to itself)")
assertEqual(resolveFallbackSupplier(undefined), null, 'missing setting row (undefined) → null')
assertEqual(resolveFallbackSupplier('garbage'), null, 'unrecognized value → null (fail safe, not fail open)')

if (process.exitCode === 1) {
    console.error('\nSome tests failed.')
} else {
    console.log('\nAll tests passed.')
}
