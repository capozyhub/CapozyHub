// scripts/test-bundleportal-apply-outcome.ts
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'

import { mapBundlePortalEventToStatus, parseBundlePortalOrderId } from '../lib/bundleportal-apply-outcome'

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

assertEqual(mapBundlePortalEventToStatus('order.completed'), 'completed', 'order.completed -> completed')
assertEqual(mapBundlePortalEventToStatus('order.failed'), 'failed', 'order.failed -> failed')
assertEqual(mapBundlePortalEventToStatus('order.cancelled'), 'failed', 'order.cancelled -> failed (never delivered)')
assertEqual(mapBundlePortalEventToStatus('order.refunded'), 'failed', 'order.refunded -> failed, NEVER our own refunded status (that means the wallet-credit RPC already ran)')

// ── parseBundlePortalOrderId (Finding 2 fix: retry-dispatched orders can never resolve) ────
// Plain UUID passthrough — the common, non-retry case.
assertEqual(
    parseBundlePortalOrderId('a1b2c3d4-e5f6-4789-a012-3456789abcde'),
    { type: 'uuid', id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde' },
    'parseBundlePortalOrderId: plain UUID -> {type: uuid, id}',
)

// Composite retry dispatch key, exactly as built by lib/retry-service.ts:
// `dispatchKey = \`${orderId}:${claimResult.attempt_no}\``.
assertEqual(
    parseBundlePortalOrderId('a1b2c3d4-e5f6-4789-a012-3456789abcde:2'),
    { type: 'retry', sourceOrderId: 'a1b2c3d4-e5f6-4789-a012-3456789abcde', attemptNo: 2 },
    'parseBundlePortalOrderId: composite retry key -> {type: retry, sourceOrderId, attemptNo}',
)

assertEqual(
    parseBundlePortalOrderId('not-a-uuid-at-all'),
    { type: 'unknown' },
    'parseBundlePortalOrderId: unrecognized shape -> {type: unknown}',
)

assertEqual(
    parseBundlePortalOrderId(''),
    { type: 'unknown' },
    'parseBundlePortalOrderId: empty string -> {type: unknown}',
)
