// scripts/test-subagent-regenerate.ts
//
// Business-rule tests for lib/sub-agent-regenerate.ts (Plan 3, Task 5). Asserts
// the RULES a recruiter's regenerate-key action must enforce — not the route's
// HTTP plumbing — using a hand-rolled fake SupabaseClient and fake SMS/email
// senders, matching this repo's established test convention
// (scripts/test-subagent-create.ts, scripts/test-sub-agent-key.ts). No real
// database connection, no real network calls.
//
// Schema note: sub_agents/users columns referenced here come from
// supabase/migrations/20260701_sub_agents.sql, 20260907_sub_agent_account_edge.sql
// and 20260914_subagent_auth.sql — NOT yet applied to any database (see
// task-5-brief.md), so this fake-db approach is the only way to exercise this
// logic today.

import { regenerateSubAgentKey } from '../lib/sub-agent-regenerate'

let pass = 0, fail = 0
function assert(cond: boolean, msg: string) {
    if (cond) { console.log(`PASS: ${msg}`); pass++ }
    else { console.error(`FAIL: ${msg}`); fail++ }
}

type Row = Record<string, any>

interface FakeDbConfig {
    subAgents?: Row[]
    users?: Row[]
    subAgentsUpdateError?: any
    usersLookupError?: any
}

// Mirrors the hand-rolled fake-SupabaseClient pattern from
// scripts/test-subagent-create.ts / scripts/test-sub-agent-key.ts — supports
// the .from().select().eq().maybeSingle() and .from().update().eq() chains
// lib/sub-agent-key.ts's beginRegenerate and lib/sub-agent-regenerate.ts
// actually call.
function fakeDb(config: FakeDbConfig) {
    const subAgentsUpdates: any[] = []

    function tableRows(table: string): Row[] {
        if (table === 'sub_agents') return config.subAgents ?? []
        if (table === 'users') return config.users ?? []
        return []
    }

    const db: any = {
        from(table: string) {
            let rows = [...tableRows(table)]

            const builder: any = {
                select(_cols?: string) {
                    return builder
                },
                eq(col: string, val: any) {
                    rows = rows.filter((r) => r[col] === val)
                    return builder
                },
                async maybeSingle() {
                    if (table === 'sub_agents' && config.subAgentsUpdateError !== undefined && rows.length === 0) {
                        // no-op; kept for symmetry, lookup errors are handled via a
                        // dedicated 'error' row below when needed
                    }
                    if (table === 'users' && config.usersLookupError) {
                        return { data: null, error: config.usersLookupError }
                    }
                    return { data: rows[0] ?? null, error: null }
                },
                update(payload: any) {
                    return {
                        eq(_col: string, _val: any) {
                            if (table === 'sub_agents') subAgentsUpdates.push(payload)
                            const error = table === 'sub_agents' ? (config.subAgentsUpdateError ?? null) : null
                            return Promise.resolve({ error })
                        },
                    }
                },
            }
            return builder
        },
    }

    return { db, subAgentsUpdates }
}

function fakeDeps(opts: { smsResult?: { success: boolean; error?: string }; emailResult?: { success: boolean; error?: string } } = {}) {
    const smsCalls: any[] = []
    const emailCalls: any[] = []
    const deps = {
        async sendSms(options: { recipient: string; message: string }) {
            smsCalls.push(options)
            return opts.smsResult ?? { success: true, messageId: 'sms-1' }
        },
        async sendEmail(options: { to: string; toName?: string; subject: string; htmlContent: string }) {
            emailCalls.push(options)
            return opts.emailResult ?? { success: true, messageId: 'email-1' }
        },
    }
    return { deps, smsCalls, emailCalls }
}

const SUB_ID = 'sub-1'
const RECRUITER_ID = 'lead-1'

async function main() {

    // ── Rule 2: no sub_agents row at all for the target id -> 404 ──
    {
        const { db } = fakeDb({ subAgents: [] })
        const { deps, smsCalls, emailCalls } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, {}, deps)
        assert(r.success === false, 'no sub_agents row: rejected')
        assert(r.status === 404, 'no sub_agents row: 404')
        assert(smsCalls.length === 0 && emailCalls.length === 0, 'no sub_agents row: no delivery attempted')
    }

    // ── Rule 2: caller is NOT the sub's actual upline -> 403 ──
    {
        const { db } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: 'someone-else' }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
        })
        const { deps, smsCalls, emailCalls } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, {}, deps)
        assert(r.success === false, 'wrong upline: rejected')
        assert(r.status === 403, 'wrong upline: 403')
        assert(smsCalls.length === 0 && emailCalls.length === 0, 'wrong upline: no delivery attempted')
    }

    // ── Rule 3: body contains `email` key AT ALL -> 400, even before any DB read ──
    {
        const { db, subAgentsUpdates } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
        })
        const { deps, smsCalls, emailCalls } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, { email: 'attacker@evil.com' }, deps)
        assert(r.success === false, 'body has email field: rejected')
        assert(r.status === 400, 'body has email field: 400')
        assert(subAgentsUpdates.length === 0, 'body has email field: beginRegenerate never called (no pending key staged)')
        assert(smsCalls.length === 0 && emailCalls.length === 0, 'body has email field: no delivery attempted')
    }

    // ── Rule 3: body contains `phone` key AT ALL -> 400 ──
    {
        const { db, subAgentsUpdates } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
        })
        const { deps } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, { phone: '0209999999' }, deps)
        assert(r.success === false, 'body has phone field: rejected')
        assert(r.status === 400, 'body has phone field: 400')
        assert(subAgentsUpdates.length === 0, 'body has phone field: beginRegenerate never called')
    }

    // ── Rule 3: body has email field set to null/empty string -> STILL 400
    //    (presence, not truthiness, is what triggers the reject) ──
    {
        const { db } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
        })
        const { deps } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, { email: null }, deps)
        assert(r.success === false, 'body has email:null: still rejected (presence check, not truthiness)')
        assert(r.status === 400, 'body has email:null: 400')
    }

    // ── Rule 3: body with unrelated fields (no email/phone) is fine ──
    {
        const { db } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
        })
        const { deps } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, { note: 'routine rotation' }, deps)
        assert(r.success === true, 'body with unrelated field only: succeeds')
    }

    // ── Rule 4/5: happy path — beginRegenerate called exactly once, plaintext
    //    passed to BOTH senders using the sub's OWN users row contact info,
    //    NEVER present anywhere in the returned result ──
    {
        const { db, subAgentsUpdates } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
        })
        const { deps, smsCalls, emailCalls } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, {}, deps)

        assert(r.success === true, 'happy path: succeeds')
        assert(r.status === 200, 'happy path: 200')
        assert(subAgentsUpdates.length === 1, 'happy path: beginRegenerate called exactly once (exactly one sub_agents update)')

        const stagedHash = subAgentsUpdates[0]?.pending_key_hash
        assert(typeof stagedHash === 'string' && stagedHash.length > 0, 'happy path: a pending_key_hash was staged')

        assert(smsCalls.length === 1, 'happy path: exactly one SMS send')
        assert(smsCalls[0].recipient === '0241234567', "happy path: SMS sent to the sub's OWN phone_number from their users row")
        assert(emailCalls.length === 1, 'happy path: exactly one email send')
        assert(emailCalls[0].to === 'sub@example.com', "happy path: email sent to the sub's OWN email from their users row")

        // The plaintext key must appear in BOTH delivery payloads (that's the
        // only place it's allowed to exist) and MUST NOT appear anywhere in
        // the returned result object.
        const smsMsg: string = smsCalls[0].message
        const emailHtml: string = emailCalls[0].htmlContent
        const plaintextCandidates = smsMsg.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/g) ?? []
        assert(plaintextCandidates.length === 1, 'happy path: SMS body contains exactly one key-shaped token')
        const plaintextKey = plaintextCandidates[0]
        assert(emailHtml.includes(plaintextKey), 'happy path: email body contains the SAME plaintext key as the SMS')

        const resultJson = JSON.stringify(r)
        assert(!resultJson.includes(plaintextKey), 'happy path: the plaintext key NEVER appears in the returned result (never reaches the HTTP response)')
    }

    // ── Delivery failures don't fail the whole operation (best-effort, logged) —
    //    the key is already staged and will work on next login regardless ──
    {
        const { db } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
        })
        const { deps } = fakeDeps({ smsResult: { success: false, error: 'provider down' } })
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, {}, deps)
        assert(r.success === true, 'SMS delivery failure: regenerate still reports success (key is staged either way)')
    }

    // ── beginRegenerate itself failing (DB error) -> 500, no delivery attempted ──
    {
        const { db } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [{ id: SUB_ID, email: 'sub@example.com', phone_number: '0241234567', first_name: 'Kofi' }],
            subAgentsUpdateError: { code: '42501', message: 'permission denied' },
        })
        const { deps, smsCalls, emailCalls } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, {}, deps)
        assert(r.success === false, 'beginRegenerate DB failure: reported as failure')
        assert(r.status === 500, 'beginRegenerate DB failure: 500')
        assert(smsCalls.length === 0 && emailCalls.length === 0, 'beginRegenerate DB failure: no delivery attempted')
    }

    // ── Sub has no users row (edge case) -> regenerate still reports success
    //    (key staged), but no delivery is attempted since there's nothing to
    //    deliver to ──
    {
        const { db, subAgentsUpdates } = fakeDb({
            subAgents: [{ user_id: SUB_ID, upline_user_id: RECRUITER_ID }],
            users: [],
        })
        const { deps, smsCalls, emailCalls } = fakeDeps()
        const r = await regenerateSubAgentKey(db, RECRUITER_ID, SUB_ID, {}, deps)
        assert(r.success === true, 'no users row: regenerate still succeeds (key was staged)')
        assert(subAgentsUpdates.length === 1, 'no users row: beginRegenerate was still called')
        assert(smsCalls.length === 0 && emailCalls.length === 0, 'no users row: no delivery attempted (nothing to deliver to)')
    }

    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(fail > 0 ? 1 : 0)
}

main()
