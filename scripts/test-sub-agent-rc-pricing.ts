// scripts/test-sub-agent-rc-pricing.ts
import { resolveSubAgentRcCost } from '../lib/sub-agent-rc-pricing'

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
const TYPE = { id: 'type-1', customer_price: 14, agent_price: 13, dealer_price: 12.5, cost_price: 10, name: 'WASSCE' }

async function main() {
    // ── Not a sub: pass-through ──
    {
        const db = fakeDb({ sub_agents: [], users: [] })
        const r = await resolveSubAgentRcCost(db, 'nobody', TYPE, 1)
        assertEqual(r.isSub, false, 'non-sub: isSub false')
        assertEqual(r.subCost, 0, 'non-sub: subCost 0')
    }

    // ── Healthy sub, override markup ──
    {
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-1', markup: 0.5 }],
            sub_agent_default_pricing: [],
        })
        const r = await resolveSubAgentRcCost(db, 'kofi', TYPE, 1)
        assertEqual(r.subCost, 13.5, 'healthy sub: subCost = recruiterCost(agent=13) + markup(0.5)')
        assertEqual(r.recruiterEarns, 0.5, 'healthy sub: recruiterEarns = 0.5')
    }

    // ── No pricing rows: zero markup, sub buys at recruiter's exact cost ──
    {
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [],
            sub_agent_default_pricing: [],
        })
        const r = await resolveSubAgentRcCost(db, 'kofi', TYPE, 1)
        assertEqual(r.subCost, 13, 'no pricing rows: subCost = recruiterCost exactly')
        assertEqual(r.recruiterEarns, 0, 'no pricing rows: recruiterEarns 0')
    }

    // ── Ceiling TEMPORARILY DISABLED (Task 6, 2026-09-14, explicit user request — see the
    //    marker in lib/pricing/sub-agent-cost.ts): a markup pushing subCost above the
    //    customer price is now accepted, not rejected. Restore the `ok, false` assertion
    //    here when the ceiling check itself is reinstated. ──
    {
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-1', markup: 5 }],
            sub_agent_default_pricing: [],
        })
        const r = await resolveSubAgentRcCost(db, 'kofi', TYPE, 1)
        assertEqual(r.ok, true, 'former ceiling breach is currently ALLOWED (ceiling disabled): subCost 18 > customer price 14')
        assertEqual(r.subCost, 18, 'subCost above customer price still computed normally')
    }

    // ── A different type's pricing row does not leak in ──
    {
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-OTHER', markup: 5 }],
            sub_agent_default_pricing: [],
        })
        const r = await resolveSubAgentRcCost(db, 'kofi', TYPE, 1)
        assertEqual(r.subCost, 13, 'different type_id: does not apply, falls back to zero markup')
    }

    // ── Bulk-tier awareness (review finding C1): recruiter cost follows the bulk tier at the
    //    purchased quantity, not the flat role price. Before the fix, resolveSubAgentRcCost
    //    derived cost from getPriceForRole (flat agent price 13) alone, ignoring bulk_pricing
    //    entirely — a sub buying in bulk would have been quoted 13, MORE per unit than the bulk
    //    tier's 11, even though a walk-in customer at the same quantity gets the bulk discount.
    {
        const TYPE_BULK = {
            ...TYPE,
            bulk_pricing: [{ min_qty: 10, max_qty: 100, unit_price: 11 }],
        }
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-1', markup: 0 }],
            sub_agent_default_pricing: [],
        })
        const r = await resolveSubAgentRcCost(db, 'kofi', TYPE_BULK, 20)
        // recruiterCost = bulk tier price (11) applies uniformly regardless of role, since
        // bulk_pricing is not role-specific — same tier the customer ceiling also resolves to.
        assertEqual(r.subCost, 11, 'bulk tier: subCost uses the bulk unit price (11), not the flat agent price (13)')
        assertEqual(r.recruiterEarns, 0, 'bulk tier: recruiterEarns 0 with 0 markup')
    }

    // ── Bulk-tier-aware ceiling breach TEMPORARILY DISABLED (Task 6, 2026-09-14, explicit
    //    user request — see the marker in lib/pricing/sub-agent-cost.ts): a markup that
    //    breaches the tighter bulk-tier ceiling (11) is now accepted, not rejected.
    //    Restore the `ok, false` assertion here when the ceiling check itself is
    //    reinstated. ──
    {
        const TYPE_BULK = {
            ...TYPE,
            bulk_pricing: [{ min_qty: 10, max_qty: 100, unit_price: 11 }],
        }
        const db = fakeDb({
            sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
            users: [LIFETIME_AGENT_ROW],
            sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'results_checker', product_ref: 'type-1', markup: 0.5 }],
            sub_agent_default_pricing: [],
        })
        const r = await resolveSubAgentRcCost(db, 'kofi', TYPE_BULK, 20)
        assertEqual(r.ok, true, 'former bulk-tier ceiling breach is currently ALLOWED (ceiling disabled): subCost 11.5 > bulk ceiling 11')
        assertEqual(r.subCost, 11.5, 'subCost above bulk ceiling still computed normally')
    }
}

main()
