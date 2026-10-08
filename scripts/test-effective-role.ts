// scripts/test-effective-role.ts
//
// effectiveRoleFromExpiry decides what tier a user is CHARGED at on every
// surface — dashboard, storefront, USSD and the v2 developer API. Getting it
// wrong either overcharges a paying reseller or leaks a discount to a lapsed
// one, so the boundary rules are pinned here.
import { effectiveRoleFromExpiry } from '@/lib/effective-role'

function assertRole(
    actual: string,
    expected: string,
    label: string,
) {
    if (actual !== expected) throw new Error(`${label}: expected "${expected}", got "${actual}"`)
}

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

// ── NULL expiry means permanent/lifetime — honour the granted role ──────────
assertRole(effectiveRoleFromExpiry('dealer', null, null), 'dealer', 'permanent dealer')
assertRole(effectiveRoleFromExpiry('agent', null, null), 'agent', 'permanent agent')
assertRole(effectiveRoleFromExpiry('customer', null, null), 'customer', 'plain customer')

// ── Unexpired expiry keeps the tier ─────────────────────────────────────────
assertRole(effectiveRoleFromExpiry('dealer', null, future), 'dealer', 'active dealer')
assertRole(effectiveRoleFromExpiry('agent', future, null), 'agent', 'active agent')

// ── Expired falls back to customer. This is the case that was leaking a ──────
//    discount on airtime and result checkers before 2026-08-25.
assertRole(effectiveRoleFromExpiry('dealer', null, past), 'customer', 'EXPIRED dealer prices as customer')
assertRole(effectiveRoleFromExpiry('agent', past, null), 'customer', 'EXPIRED agent prices as customer')

// ── A non-NULL expiry is authoritative over the role column, in BOTH ─────────
//    directions: nothing downgrades an expired agent, so users.role keeps
//    saying 'agent' long after agent_expires_at passed.
assertRole(effectiveRoleFromExpiry('agent', past, future), 'dealer', 'dealer expiry wins over stale agent role')
assertRole(effectiveRoleFromExpiry('customer', future, null), 'agent', 'live agent expiry beats a customer role column')

// ── Dealer outranks agent when both are live ────────────────────────────────
assertRole(effectiveRoleFromExpiry('agent', future, future), 'dealer', 'dealer beats agent')

// ── Boundary: an expiry exactly equal to now counts as EXPIRED (strict >). ───
//    Authoritative for pricing as of the 2026-08-25 unification; the old
//    isActiveDealerV1 in data/purchase used `< now` and disagreed by 1ms.
const now = new Date().toISOString()
assertRole(effectiveRoleFromExpiry('dealer', null, now), 'customer', 'expiry == now is EXPIRED (dealer)')
assertRole(effectiveRoleFromExpiry('agent', now, null), 'customer', 'expiry == now is EXPIRED (agent)')

// ── Defensive: null/undefined role with no expiry ───────────────────────────
assertRole(effectiveRoleFromExpiry(null, null, null), 'customer', 'null role')
assertRole(effectiveRoleFromExpiry(undefined, null, null), 'customer', 'undefined role')

console.log('All effective-role tests passed.')
