// npx tsx scripts/test-support-ticks.ts
import { getCounterpartReceipt, getMessageTickState } from '../lib/support-ticks'

let failures = 0
function assertEqual(actual: unknown, expected: unknown, label: string) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected)
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
    if (!ok) {
        console.log(`  expected: ${JSON.stringify(expected)}`)
        console.log(`  actual:   ${JSON.stringify(actual)}`)
        failures++
    }
}

const NONE = {
    delivered_to_user_at: null,
    delivered_to_admin_at: null,
    read_by_user_at: null,
    read_by_admin_at: null,
}

// Admin-sent message: ticks come from the user's delivered/read columns.
assertEqual(
    getMessageTickState(getCounterpartReceipt('admin', NONE)),
    'sent',
    'admin message with no delivery/read data is sent'
)
assertEqual(
    getMessageTickState(getCounterpartReceipt('admin', { ...NONE, delivered_to_user_at: '2026-09-27T00:00:00Z' })),
    'delivered',
    'admin message delivered to user is delivered'
)
assertEqual(
    getMessageTickState(getCounterpartReceipt('admin', {
        ...NONE,
        delivered_to_user_at: '2026-09-27T00:00:00Z',
        read_by_user_at: '2026-09-27T00:05:00Z',
    })),
    'read',
    'admin message read by user is read'
)
// Read implies delivered even if delivered_to_user_at is somehow missing
// (e.g. legacy backfilled rows) — read always wins.
assertEqual(
    getMessageTickState(getCounterpartReceipt('admin', { ...NONE, read_by_user_at: '2026-09-27T00:05:00Z' })),
    'read',
    'admin message read without a recorded delivered_at is still read'
)

// User-sent message: ticks come from the admin's delivered/read columns —
// must not be confused with the user's own columns.
assertEqual(
    getMessageTickState(getCounterpartReceipt('user', {
        ...NONE,
        delivered_to_user_at: '2026-09-27T00:00:00Z', // irrelevant — wrong direction
        read_by_user_at: '2026-09-27T00:05:00Z',       // irrelevant — wrong direction
    })),
    'sent',
    'user message ignores the user-direction columns entirely'
)
assertEqual(
    getMessageTickState(getCounterpartReceipt('user', { ...NONE, delivered_to_admin_at: '2026-09-27T00:00:00Z' })),
    'delivered',
    'user message delivered to admin is delivered'
)
assertEqual(
    getMessageTickState(getCounterpartReceipt('user', {
        ...NONE,
        delivered_to_admin_at: '2026-09-27T00:00:00Z',
        read_by_admin_at: '2026-09-27T00:05:00Z',
    })),
    'read',
    'user message read by admin is read'
)

if (failures > 0) {
    console.error(`\n${failures} test(s) failed`)
    process.exit(1)
}
console.log('\nAll support-ticks tests passed')
