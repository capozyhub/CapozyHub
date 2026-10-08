// scripts/test-sub-agent-data-pricing.ts
import { resolveSubAgentDataCost } from '../lib/sub-agent-data-pricing'

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
                async single() { return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'not found' } } },
            }
            return builder
        },
    } as any
}

const LIFETIME_AGENT_ROW = { id: 'lead', role: 'agent', agent_expires_at: null, dealer_expires_at: null }
const PKG = { price: 10, agent_price: 4, dealer_price: 3.5, cost_price: 3 }

// Wrapped in an async main() rather than top-level await: this repo's package.json has
// no "type": "module", so tsx transpiles scripts to CommonJS, and esbuild's cjs output
// format does not support top-level await. Function-level await works identically here —
// every test case/assertion below is unchanged from the brief, only the wrapper differs.
async function main() {

// ── Not a sub: pass-through, nothing applies ──
{
    const db = fakeDb({ sub_agents: [], users: [] })
    const r = await resolveSubAgentDataCost(db, 'nobody', 'pkg-1', PKG, 'data')
    assertEqual(r.ok, true, 'non-sub: ok')
    assertEqual(r.isSub, false, 'non-sub: isSub false')
    assertEqual(r.subCost, 0, 'non-sub: subCost 0 (caller uses the normal role price instead)')
}

// ── Healthy sub, data category, has a markup override ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'data', product_ref: 'pkg-1', markup: 1 }],
        sub_agent_default_pricing: [],
    })
    const r = await resolveSubAgentDataCost(db, 'kofi', 'pkg-1', PKG, 'data')
    assertEqual(r.ok, true, 'healthy sub + override: ok')
    assertEqual(r.isSub, true, 'healthy sub + override: isSub true')
    assertEqual(r.subCost, 5, 'healthy sub + override: subCost = recruiterCost(4) + markup(1)')
    assertEqual(r.recruiterEarns, 1, 'healthy sub + override: recruiterEarns = 1')
    assertEqual(r.recruiterId, 'lead', 'healthy sub + override: recruiterId resolved')
}

// ── Healthy sub, no pricing rows at all: zero markup default ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [],
        sub_agent_default_pricing: [],
    })
    const r = await resolveSubAgentDataCost(db, 'kofi', 'pkg-1', PKG, 'data')
    assertEqual(r.subCost, 4, 'no pricing rows: subCost = recruiterCost exactly')
    assertEqual(r.recruiterEarns, 0, 'no pricing rows: recruiterEarns is 0')
}

// ── MASHUP: markup forced to 0, sub_agent_pricing/default NEVER queried ──
{
    let pricingTableTouched = false
    const db = {
        from(table: string) {
            if (table === 'sub_agent_pricing' || table === 'sub_agent_default_pricing') {
                pricingTableTouched = true
            }
            const rows: any[] =
                table === 'sub_agents' ? [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }] :
                table === 'users' ? [LIFETIME_AGENT_ROW] : []
            let filtered = [...rows]
            const builder: any = {
                select() { return builder },
                eq(col: string, val: any) { filtered = filtered.filter(r => r[col] === val); return builder },
                async maybeSingle() { return { data: filtered[0] ?? null, error: null } },
            }
            return builder
        },
    } as any
    const r = await resolveSubAgentDataCost(db, 'kofi', 'pkg-1', PKG, 'mashup')
    assertEqual(pricingTableTouched, false, 'mashup: pricing tables never queried')
    assertEqual(r.subCost, 4, 'mashup: subCost = recruiterCost exactly, zero markup')
    assertEqual(r.recruiterEarns, 0, 'mashup: recruiterEarns is 0')
}

// ── Suspended sub: fails closed ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'suspended' }],
        users: [LIFETIME_AGENT_ROW],
    })
    const r = await resolveSubAgentDataCost(db, 'kofi', 'pkg-1', PKG, 'data')
    assertEqual(r.ok, false, 'suspended sub: rejected')
    assertEqual(r.isSub, true, 'suspended sub: isSub still true (caller must reject, not fall through)')
    assertEqual(r.subCost, 0, 'suspended sub: subCost 0 (fail closed)')
    assertEqual(r.recruiterEarns, 0, 'suspended sub: recruiterEarns 0 (fail closed)')
}

// ── Ineligible recruiter (expired dealer): fails closed ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [{ id: 'lead', role: 'dealer', agent_expires_at: null, dealer_expires_at: '2020-01-01T00:00:00Z' }],
    })
    const r = await resolveSubAgentDataCost(db, 'kofi', 'pkg-1', PKG, 'data')
    assertEqual(r.ok, false, 'ineligible recruiter: rejected')
}

// ── Ceiling TEMPORARILY DISABLED (Task 6, 2026-09-14, explicit user request — see the
//    marker in lib/pricing/sub-agent-cost.ts): a markup pushing subCost above the
//    customer price is now accepted, not rejected. Restore the `ok, false` assertion
//    here when the ceiling check itself is reinstated. ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [LIFETIME_AGENT_ROW],
        sub_agent_pricing: [{ sub_user_id: 'kofi', product_type: 'data', product_ref: 'pkg-1', markup: 10 }],
        sub_agent_default_pricing: [],
    })
    const r = await resolveSubAgentDataCost(db, 'kofi', 'pkg-1', PKG, 'data')
    assertEqual(r.ok, true, 'former ceiling breach is currently ALLOWED (ceiling disabled): subCost 14 > customer price 10')
    assertEqual(r.subCost, 14, 'subCost above customer price still computed normally')
}

}

main()
