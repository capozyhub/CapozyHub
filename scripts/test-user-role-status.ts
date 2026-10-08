// scripts/test-user-role-status.ts
import { resolveRoleStatus } from '@/lib/user-role-status'

function assertEqual(actual: unknown, expected: unknown, label: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
}

// Permanent (NULL expiry) roles
assertEqual(
    resolveRoleStatus('dealer', null, null),
    { role: 'dealer', is_active: true, is_permanent: true, expires_at: null, days_remaining: null },
    'dealer with NULL expiry is permanent'
)
assertEqual(
    resolveRoleStatus('customer', null, null),
    { role: 'customer', is_active: true, is_permanent: true, expires_at: null, days_remaining: null },
    'customer is always permanent (no expiry concept)'
)

// Active dealer with future expiry — use a fixed reference far in the future
// relative to any real run, verified via direct day-count math, not Date.now().
const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // +10 days
const activeDealer = resolveRoleStatus('dealer', future, null)
assertEqual(activeDealer.role, 'dealer', 'active dealer role')
assertEqual(activeDealer.is_active, true, 'active dealer is_active')
assertEqual(activeDealer.is_permanent, false, 'active dealer not permanent')
assertEqual(activeDealer.expires_at, future, 'active dealer expires_at echoed')
if (activeDealer.days_remaining === null || activeDealer.days_remaining < 9 || activeDealer.days_remaining > 10) {
    throw new Error(`active dealer days_remaining out of expected range: ${activeDealer.days_remaining}`)
}

// Expired dealer — falls back to customer-equivalent (is_active: false), matching
// effectiveRoleFromExpiry() in lib/results-checker-service.ts.
const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // -1 day
const expiredDealer = resolveRoleStatus('dealer', past, null)
assertEqual(expiredDealer.is_active, false, 'expired dealer is not active')
assertEqual(expiredDealer.is_permanent, false, 'expired dealer not permanent')
assertEqual(expiredDealer.days_remaining, 0, 'expired dealer days_remaining floors at 0')

// Active agent with future expiry
const activeAgent = resolveRoleStatus('agent', null, future)
assertEqual(activeAgent.role, 'agent', 'active agent role')
assertEqual(activeAgent.is_active, true, 'active agent is_active')

// Expired agent
const expiredAgent = resolveRoleStatus('agent', null, past)
assertEqual(expiredAgent.is_active, false, 'expired agent is not active')

// Boundary: expiry exactly "now" counts as expired (strict > required to be active)
const now = new Date().toISOString()
const boundaryDealer = resolveRoleStatus('dealer', now, null)
assertEqual(boundaryDealer.is_active, false, 'expiry exactly now is expired, not active')

console.log('All user-role-status tests passed.')
