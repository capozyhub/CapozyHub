// scripts/test-sub-agent-afa-pricing.ts
import { resolveSubAgentAfaCost } from '../lib/sub-agent-afa-pricing'

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
const AFA_SETTINGS = { afa_price_customer: '15', afa_price_agent: '14', afa_price_dealer: '13' }

// Wrapped in an async main() rather than top-level await: this repo's package.json has
// no "type": "module", so tsx transpiles scripts to CommonJS, and esbuild's cjs output
// format does not support top-level await. Function-level await works identically here —
// every test case/assertion below is unchanged from the brief, only the wrapper differs.
async function main() {

// ── Not a sub: pass-through ──
{
    const db = fakeDb({ sub_agents: [], users: [] })
    const r = await resolveSubAgentAfaCost(db, 'nobody', AFA_SETTINGS)
    assertEqual(r.ok, true, 'non-sub: ok')
    assertEqual(r.isSub, false, 'non-sub: isSub false')
    assertEqual(r.subCost, 0, 'non-sub: subCost 0')
}

// ── Healthy sub under a lifetime agent recruiter, with an override markup ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'afa', product_ref: 'afa_registration', markup: 1 }],
        sub_agent_default_pricing: [],
    })
    const r = await resolveSubAgentAfaCost(db, 'kofi', AFA_SETTINGS)
    assertEqual(r.ok, true, 'healthy sub: ok')
    assertEqual(r.subCost, 15, 'healthy sub: subCost = recruiterCost(agent=14) + markup(1) = 15')
    assertEqual(r.recruiterEarns, 1, 'healthy sub: recruiterEarns = 1')
    assertEqual(r.recruiterId, 'lead', 'healthy sub: recruiterId resolved')
}

// ── Healthy sub under a DEALER recruiter, no override: zero markup default ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [{ id: 'lead', role: 'dealer', agent_expires_at: null, dealer_expires_at: null }],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [],
    })
    const r = await resolveSubAgentAfaCost(db, 'kofi', AFA_SETTINGS)
    assertEqual(r.subCost, 13, 'dealer recruiter, no markup: subCost = dealer price exactly')
    assertEqual(r.recruiterEarns, 0, 'dealer recruiter, no markup: recruiterEarns 0')
}

// ── Ceiling TEMPORARILY DISABLED (Task 6, 2026-09-14, explicit user request — see the
//    marker in lib/pricing/sub-agent-cost.ts): a markup pushing subCost above the
//    customer price (15) is now accepted, not rejected. Restore the `ok, false`
//    assertion here when the ceiling check itself is reinstated. ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'afa', product_ref: 'afa_registration', markup: 2 }],
        sub_agent_default_pricing: [],
    })
    const r = await resolveSubAgentAfaCost(db, 'kofi', AFA_SETTINGS)
    assertEqual(r.ok, true, 'former ceiling breach is currently ALLOWED (ceiling disabled): subCost 16 > customer price 15')
    assertEqual(r.subCost, 16, 'subCost above customer price still computed normally')
}

// ── Suspended sub: fails closed ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'suspended' }],
        users: [LIFETIME_AGENT_ROW],
    })
    const r = await resolveSubAgentAfaCost(db, 'kofi', AFA_SETTINGS)
    assertEqual(r.ok, false, 'suspended sub: rejected')
    assertEqual(r.isSub, true, 'suspended sub: isSub still true')
    assertEqual(r.subCost, 0, 'suspended sub: subCost 0 (fail closed)')
}

// ── Ineligible recruiter (expired dealer): fails closed ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [{ id: 'lead', role: 'dealer', agent_expires_at: null, dealer_expires_at: '2020-01-01T00:00:00Z' }],
    })
    const r = await resolveSubAgentAfaCost(db, 'kofi', AFA_SETTINGS)
    assertEqual(r.ok, false, 'ineligible recruiter: rejected')
}

}

main()
