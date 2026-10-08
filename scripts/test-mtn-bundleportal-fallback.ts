import { isNotAllowlistedRejection, resolveFallbackSupplier } from '../lib/mtn-bundleportal-fallback'

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

// ── isNotAllowlistedRejection ───────────────────────────────────────────────
assertEqual(
    isNotAllowlistedRejection('MTN', { code: 'not_allowlisted' }),
    true,
    'MTN + code not_allowlisted → true'
)
assertEqual(
    isNotAllowlistedRejection('Telecel', { code: 'not_allowlisted' }),
    false,
    'non-MTN network → false even with matching code'
)
assertEqual(
    isNotAllowlistedRejection('MTN', { code: 'network_locked' }),
    false,
    'MTN + different rejection code → false'
)
assertEqual(
    isNotAllowlistedRejection('MTN', undefined),
    false,
    'MTN + missing apiResponse → false'
)
assertEqual(
    isNotAllowlistedRejection('MTN', {}),
    false,
    'MTN + apiResponse with no code field → false'
)

// ── resolveFallbackSupplier ─────────────────────────────────────────────────
assertEqual(resolveFallbackSupplier('none'), null, "'none' setting value → null (no fallback)")
assertEqual(resolveFallbackSupplier('datakazina'), 'datakazina', "'datakazina' setting value → 'datakazina'")
assertEqual(resolveFallbackSupplier('codecraft'), 'codecraft', "'codecraft' setting value → 'codecraft'")
assertEqual(resolveFallbackSupplier('agentportal'), 'agentportal', "'agentportal' setting value → 'agentportal'")
assertEqual(resolveFallbackSupplier('bundleportal'), null, "'bundleportal' itself → null (cannot fall back to itself)")
assertEqual(resolveFallbackSupplier(undefined), null, 'missing setting row (undefined) → null')
assertEqual(resolveFallbackSupplier('garbage'), null, 'unrecognized value → null (fail safe, not fail open)')
assertEqual(resolveFallbackSupplier('hendylinks'), 'hendylinks', "'hendylinks' setting value → 'hendylinks'")

if (process.exitCode === 1) {
    console.error('\nSome tests failed.')
} else {
    console.log('\nAll tests passed.')
}
