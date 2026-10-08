import { resolveSupplier } from '../lib/order-supplier'

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

assertEqual(
    resolveSupplier([], null, 'bundleportal', 'processing'),
    'bundleportal',
    "fulfillment_method='bundleportal' + status='processing' → 'bundleportal'"
)
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'bundleportal' }, created_at: '2026-08-16T10:00:00Z' }], null, null, 'pending'),
    'bundleportal',
    "tracking row tagged bundleportal, no fulfillment_method → 'bundleportal'"
)
assertEqual(
    resolveSupplier([], null, 'hendylinks', 'completed'),
    'hendylinks',
    "fulfillment_method='hendylinks' + status='completed' → 'hendylinks'"
)
assertEqual(
    resolveSupplier([{ api_response: { supplier: 'hendylinks' }, created_at: '2026-08-19T10:00:00Z' }], null, null, 'pending'),
    'hendylinks',
    "tracking row tagged hendylinks, no fulfillment_method → 'hendylinks'"
)

if (process.exitCode === 1) {
    console.error('\nSome tests failed.')
} else {
    console.log('\nAll tests passed.')
}
