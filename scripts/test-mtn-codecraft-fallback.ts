import { isUnverifiedNumberRejection, resolveFallbackSupplier } from '../lib/mtn-codecraft-fallback'

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

// ── isUnverifiedNumberRejection ─────────────────────────────────────────────

assertEqual(
    isUnverifiedNumberRejection('MTN', { status: 422 }),
    true,
    'MTN + numeric 422 → true'
)

assertEqual(
    isUnverifiedNumberRejection('MTN', { status: '422' }),
    true,
    'MTN + string "422" → true'
)

assertEqual(
    isUnverifiedNumberRejection('Telecel', { status: 422 }),
    false,
    'non-MTN network → false even with 422'
)

assertEqual(
    isUnverifiedNumberRejection('MTN', { status: 101 }),
    false,
    'MTN + different rejection code (101 = out of stock) → false'
)

assertEqual(
    isUnverifiedNumberRejection('MTN', undefined),
    false,
    'MTN + missing apiResponse → false'
)

assertEqual(
    isUnverifiedNumberRejection('MTN', {}),
    false,
    'MTN + apiResponse with no status field → false'
)

// ── resolveFallbackSupplier ──────────────────────────────────────────────────

assertEqual(
    resolveFallbackSupplier('none'),
    null,
    "'none' setting value → null (no fallback)"
)

assertEqual(
    resolveFallbackSupplier('datakazina'),
    'datakazina',
    "'datakazina' setting value → 'datakazina'"
)

assertEqual(
    resolveFallbackSupplier('xpress'),
    'xpress',
    "'xpress' setting value → 'xpress'"
)

assertEqual(
    resolveFallbackSupplier('ghdata'),
    'ghdata',
    "'ghdata' setting value → 'ghdata'"
)

assertEqual(
    resolveFallbackSupplier(undefined),
    null,
    'missing setting row (undefined) → null'
)

assertEqual(
    resolveFallbackSupplier('garbage'),
    null,
    'unrecognized value → null (fail safe, not fail open)'
)

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
