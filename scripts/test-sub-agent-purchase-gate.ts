// scripts/test-sub-agent-purchase-gate.ts
// Plan 4, Task 11 — server-side enforcement of spec C4's "unconfigured = unbuyable"
// guarantee at the three purchase call sites (app/api/orders/purchase/route.ts,
// app/api/user/afa-registration/route.ts, lib/results-checker-service.ts's
// purchaseWithWallet). Each of those routes gates on the exact same composition —
// resolveSubAgentContext (lib/sub-agent-account.ts) then hasSubAgentPricingConfigured
// (lib/sub-agent-pricing.ts) — both already independently unit-tested (see
// test-sub-agent-account.ts / test-sub-agent-pricing.ts). This file proves the
// COMPOSITION the routes actually run: unconfigured -> reject, configured-at-zero
// -> allow, non-sub/inactive-sub -> the pre-check never fires (falls through to each
// resolver's own existing fail-closed path unchanged). Mirrors the fakeDb() harness
// convention already used by test-sub-agent-pricing.ts and test-sub-agent-data-pricing.ts —
// no new test-harness pattern invented.

import { resolveSubAgentContext } from '../lib/sub-agent-account'
import { hasSubAgentPricingConfigured } from '../lib/sub-agent-pricing'

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

type Row = Record<string, any>

function fakeDb(tables: Record<string, Row[]>) {
    return {
        from(table: string) {
            let rows = [...(tables[table] ?? [])]
            const builder: any = {
                select() { return builder },
                eq(col: string, val: any) { rows = rows.filter(r => r[col] === val); return builder },
                async maybeSingle() { return { data: rows[0] ?? null, error: null } },
            }
            return builder
        },
    } as any
}

const LIFETIME_AGENT_ROW = { id: 'lead', role: 'agent', agent_expires_at: null, dealer_expires_at: null }

/**
 * The exact composition each of the three purchase call sites runs, BEFORE calling
 * its own resolveSubAgentDataCost/resolveSubAgentAfaCost/resolveSubAgentRcCost —
 * reproduced here (not imported — nothing to import, it's inline at each call site)
 * so the composition itself is exercised against the real resolveSubAgentContext and
 * hasSubAgentPricingConfigured implementations. Returns true when the purchase must be
 * REJECTED (409 in every route, SUB_AGENT_PRICING_UNAVAILABLE thrown in purchaseWithWallet).
 */
async function purchaseGateRejects(
    db: any, userId: string, productType: 'data' | 'afa' | 'results_checker', productRef: string,
): Promise<boolean> {
    const ctx = await resolveSubAgentContext(db, userId)
    return !!(
        ctx.isSub && ctx.effectiveActive && ctx.recruiterId
        && !(await hasSubAgentPricingConfigured(db, ctx.recruiterId, userId, productType, productRef))
    )
}

async function main() {

// ── data: unconfigured sub -> gate rejects ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [],
    })
    const rejected = await purchaseGateRejects(db, 'kofi', 'data', 'pkg-1')
    assertEqual(rejected, true, 'data: unconfigured sub rejected before resolveSubAgentDataCost')
}

// ── data: configured at exactly zero markup -> gate allows (legal, distinct from unconfigured) ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [{ id: 'd1', recruiter_id: 'lead', product_type: 'data', product_ref: 'pkg-1', markup: 0 }],
    })
    const rejected = await purchaseGateRejects(db, 'kofi', 'data', 'pkg-1')
    assertEqual(rejected, false, 'data: recruiter-configured zero markup is NOT treated as unconfigured')
}

// ── afa: unconfigured sub -> gate rejects ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [],
    })
    const rejected = await purchaseGateRejects(db, 'kofi', 'afa', 'afa_registration')
    assertEqual(rejected, true, 'afa: unconfigured sub rejected before resolveSubAgentAfaCost')
}

// ── afa: configured at exactly zero markup -> gate allows ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [{ id: 'p1', sub_user_id: 'kofi', product_type: 'afa', product_ref: 'afa_registration', markup: 0 }],
        sub_agent_default_pricing: [],
    })
    const rejected = await purchaseGateRejects(db, 'kofi', 'afa', 'afa_registration')
    assertEqual(rejected, false, 'afa: recruiter-configured zero markup is NOT treated as unconfigured')
}

// ── results_checker: unconfigured sub -> gate rejects ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [],
    })
    const rejected = await purchaseGateRejects(db, 'kofi', 'results_checker', 'rc-type-1')
    assertEqual(rejected, true, 'results_checker: unconfigured sub rejected before resolveSubAgentRcCost')
}

// ── results_checker: configured at exactly zero markup -> gate allows ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [{ id: 'd1', recruiter_id: 'lead', product_type: 'results_checker', product_ref: 'rc-type-1', markup: 0 }],
    })
    const rejected = await purchaseGateRejects(db, 'kofi', 'results_checker', 'rc-type-1')
    assertEqual(rejected, false, 'results_checker: recruiter-configured zero markup is NOT treated as unconfigured')
}

// ── non-sub: gate never fires regardless of pricing tables ──
{
    const db = fakeDb({ sub_agents: [], users: [] })
    const rejected = await purchaseGateRejects(db, 'ama', 'data', 'pkg-1')
    assertEqual(rejected, false, 'non-sub: gate never fires (normal role-price path untouched)')
}

// ── inactive (suspended) sub: gate does not fire here — falls through unchanged to each
// resolver's own existing effectiveActive fail-closed check (same 409/message either way) ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'suspended' }],
        users: [LIFETIME_AGENT_ROW],
    })
    const rejected = await purchaseGateRejects(db, 'kofi', 'data', 'pkg-1')
    assertEqual(rejected, false, 'suspended sub: pre-check gate itself does not fire (effectiveActive false short-circuits it)')
}

}

main()
