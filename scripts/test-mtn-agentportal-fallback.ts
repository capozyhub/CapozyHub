import { isWhitelistRejection, resolveFallbackSupplier } from '../lib/mtn-agentportal-fallback'

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

// ── isWhitelistRejection ──────────────────────────────────────────────────────

assertEqual(
    isWhitelistRejection('MTN', { rejected: [{ msisdn: '0247654321', reason: 'not enabled on MTN yet' }] }),
    true,
    'MTN + non-empty rejected[] → true'
)

assertEqual(
    isWhitelistRejection('Telecel', { rejected: [{ msisdn: '0247654321', reason: 'x' }] }),
    false,
    'non-MTN network → false even with rejected[]'
)

assertEqual(
    isWhitelistRejection('MTN', { rejected: [] }),
    false,
    'MTN + empty rejected[] → false'
)

assertEqual(
    isWhitelistRejection('MTN', { error: 'insufficient wallet balance' }),
    false,
    'MTN + no rejected field at all (e.g. a 402) → false'
)

assertEqual(
    isWhitelistRejection('MTN', undefined),
    false,
    'MTN + missing apiResponse → false'
)

// ── resolveFallbackSupplier ──────────────────────────────────────────────────

assertEqual(resolveFallbackSupplier('none'), null, "'none' → null")
assertEqual(resolveFallbackSupplier('datakazina'), 'datakazina', "'datakazina' → 'datakazina'")
assertEqual(resolveFallbackSupplier('codecraft'), 'codecraft', "'codecraft' → 'codecraft'")
assertEqual(resolveFallbackSupplier('xpress'), 'xpress', "'xpress' → 'xpress'")
assertEqual(resolveFallbackSupplier('ghdata'), 'ghdata', "'ghdata' → 'ghdata'")
assertEqual(resolveFallbackSupplier('agentportal'), null, "'agentportal' is not a valid target for its OWN fallback → null")
assertEqual(resolveFallbackSupplier(undefined), null, 'missing setting row → null')
assertEqual(resolveFallbackSupplier('garbage'), null, 'unrecognized value → null (fail safe)')

assertEqual(
    resolveFallbackSupplier('bundleportal'),
    'bundleportal',
    "'bundleportal' setting value → 'bundleportal'"
)

assertEqual(resolveFallbackSupplier('hendylinks'), 'hendylinks', "'hendylinks' setting value → 'hendylinks'")

if (process.exitCode === 1) {
    console.error('\nSome tests failed.')
} else {
    console.log('\nAll tests passed.')
}
