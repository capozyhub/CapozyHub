// scripts/test-sub-agent-account.ts
import { resolveSubAgentContext } from '../lib/sub-agent-account'

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

const LIFETIME_AGENT = { role: 'agent', agent_expires_at: null, dealer_expires_at: null }

// Wrapped in an async main() rather than top-level await: this repo's package.json has
// no "type": "module", so tsx transpiles scripts to CommonJS, and esbuild's cjs output
// format does not support top-level await. Function-level await works identically here —
// every test case/assertion below is unchanged from the brief, only the wrapper differs.
async function main() {

// ── Not a sub ──
{
    const db = fakeDb({ sub_agents: [], users: [] })
    const r = await resolveSubAgentContext(db, 'nobody')
    assertEqual(r.isSub, false, 'non-sub: isSub false')
    assertEqual(r.effectiveActive, false, 'non-sub: not effectiveActive')
}

// ── Healthy sub under a lifetime agent ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [{ id: 'lead', ...LIFETIME_AGENT }],
    })
    const r = await resolveSubAgentContext(db, 'kofi')
    assertEqual(r.isSub, true, 'healthy sub: isSub true')
    assertEqual(r.recruiterId, 'lead', 'healthy sub: recruiter resolved')
    assertEqual(r.effectiveActive, true, 'healthy sub: active')
}

// ── Suspended sub is inactive ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'suspended' }],
        users: [{ id: 'lead', ...LIFETIME_AGENT }],
    })
    const r = await resolveSubAgentContext(db, 'kofi')
    assertEqual(r.effectiveActive, false, 'suspended sub: inactive')
    assertEqual(r.recruiter, undefined, 'suspended sub: no role snapshot handed to caller')
}

// ── Pending sub is inactive ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'pending' }],
        users: [{ id: 'lead', ...LIFETIME_AGENT }],
    })
    const r = await resolveSubAgentContext(db, 'kofi')
    assertEqual(r.effectiveActive, false, 'pending sub: inactive')
    assertEqual(r.recruiter, undefined, 'pending sub: no role snapshot handed to caller')
}

// ── Ineligible recruiter (expired dealer) takes the sub offline ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'lead', status: 'active' }],
        users: [{ id: 'lead', role: 'dealer', agent_expires_at: null, dealer_expires_at: '2020-01-01T00:00:00Z' }],
    })
    const r = await resolveSubAgentContext(db, 'kofi')
    assertEqual(r.effectiveActive, false, 'expired dealer recruiter: inactive')
    assertEqual(r.recruiter, undefined, 'expired dealer recruiter: no role snapshot handed to caller')
}

// ── Missing recruiter row entirely: fail closed ──
{
    const db = fakeDb({
        sub_agents: [{ user_id: 'kofi', upline_user_id: 'ghost', status: 'active' }],
        users: [],
    })
    const r = await resolveSubAgentContext(db, 'kofi')
    assertEqual(r.effectiveActive, false, 'missing recruiter row: inactive')
    assertEqual(r.recruiter, undefined, 'missing recruiter row: no role snapshot resolved')
}

}

main()
