// scripts/test-subagent-create.ts
//
// Business-rule tests for lib/sub-agent-create.ts (Plan 3, Task 4). Asserts the
// RULES a recruiter's sub-agent creation must enforce — not the route's HTTP
// plumbing — using a hand-rolled fake SupabaseClient, matching this repo's
// established test convention (scripts/test-sub-agent-account.ts,
// scripts/test-sub-agent-key.ts). No real database connection.
//
// Schema note: sub_agents/users/shop_global_settings columns referenced here
// come from supabase/migrations/20260701_sub_agents.sql,
// 20260907_sub_agent_account_edge.sql and 20260914_subagent_auth.sql — NOT
// yet applied to any database (see task-4-brief.md), so this fake-db approach
// is the only way to exercise this logic today.

import { createSubAgent, listSubAgents } from '../lib/sub-agent-create'
import { hashAccessKey, verifyAccessKey } from '../lib/sub-agent-key'

// Mirrors scripts/test-subagent-regenerate.ts's fakeDeps helper — injectable
// fake SMS/email senders so no test ever makes a real network call, and so
// delivery outcomes (smsDelivered/emailDelivered) are deterministic.
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

let pass = 0, fail = 0
function assert(cond: boolean, msg: string) {
    if (cond) { console.log(`PASS: ${msg}`); pass++ }
    else { console.error(`FAIL: ${msg}`); fail++ }
}

type Row = Record<string, any>

interface FakeDbConfig {
    subAgents?: Row[]
    users?: Row[]
    settings?: Row[]
    createUserImpl?: (args: any) => Promise<{ data: any; error: any }>
    // sub_agents insert / users role-update failures, keyed by nothing (single
    // config per fakeDb instance) — used to exercise the post-createUser
    // failure/compensation paths.
    insertSubAgentError?: any
    updateUserError?: any
    deleteUserImpl?: (userId: string) => Promise<{ error: any }>
    // Simulates a failed `sub_agents` count query (the recruit-cap pre-check's
    // own count read) — distinct from insertSubAgentError, which only affects
    // the LATER sub_agents INSERT after the cap pre-check has already passed.
    countSubAgentsError?: any
}

// Mirrors the hand-rolled fake-SupabaseClient pattern from
// scripts/test-sub-agent-account.ts / scripts/test-sub-agent-key.ts, extended
// with insert/update/count/in/order support and a fake Admin API — the extra
// chain shapes lib/sub-agent-create.ts actually calls.
function fakeDb(config: FakeDbConfig) {
    const inserted: { table: string; payload: any }[] = []
    const updated: { table: string; col: string; val: any; payload: any }[] = []
    const createUserCalls: any[] = []
    const deleteUserCalls: string[] = []

    function tableRows(table: string): Row[] {
        if (table === 'sub_agents') return config.subAgents ?? []
        if (table === 'users') return config.users ?? []
        if (table === 'shop_global_settings') return config.settings ?? []
        return []
    }

    const db: any = {
        from(table: string) {
            let rows = [...tableRows(table)]
            let countMode = false
            let idFilterVal: any

            const builder: any = {
                select(_cols?: string, opts?: { count?: string; head?: boolean }) {
                    if (opts?.count) countMode = true
                    return builder
                },
                eq(col: string, val: any) {
                    if (table === 'users' && col === 'id') idFilterVal = val
                    rows = rows.filter((r) => r[col] === val)
                    return builder
                },
                in(col: string, vals: any[]) {
                    rows = rows.filter((r) => vals.includes(r[col]))
                    return builder
                },
                order() {
                    return builder
                },
                async maybeSingle() {
                    // Recruiter-eligibility lookup (Rule 2): tests exercise the
                    // OTHER rules against a caller id that never appears in
                    // `config.users`, so — unless a test explicitly seeds a
                    // `users` row for that same id (as the new negative test
                    // below does, to exercise an INELIGIBLE role) — synthesize
                    // a default eligible lifetime-agent recruiter so every
                    // pre-existing rule test keeps exercising the rule it was
                    // written for, not this new gate.
                    if (table === 'users' && idFilterVal !== undefined && rows.length === 0) {
                        return {
                            data: { id: idFilterVal, role: 'agent', agent_expires_at: null, dealer_expires_at: null },
                            error: null,
                        }
                    }
                    return { data: rows[0] ?? null, error: null }
                },
                insert(payload: any) {
                    inserted.push({ table, payload })
                    const error = table === 'sub_agents' ? (config.insertSubAgentError ?? null) : null
                    return Promise.resolve({ error })
                },
                update(payload: any) {
                    return {
                        eq(col: string, val: any) {
                            updated.push({ table, col, val, payload })
                            const error = table === 'users' && payload.role === 'subagent'
                                ? (config.updateUserError ?? null)
                                : null
                            return Promise.resolve({ error })
                        },
                    }
                },
                // supabase-js query builders are thenable; awaited directly for
                // count queries (no .maybeSingle()) — e.g. the recruit-cap count
                // and listSubAgents' plain reads.
                then(resolve: (v: any) => void) {
                    if (countMode && table === 'sub_agents' && config.countSubAgentsError) {
                        resolve({ data: null, count: null, error: config.countSubAgentsError })
                        return
                    }
                    resolve({ data: rows, count: countMode ? rows.length : undefined, error: null })
                },
            }
            return builder
        },
        auth: {
            admin: {
                async createUser(args: any) {
                    createUserCalls.push(args)
                    if (config.createUserImpl) return config.createUserImpl(args)
                    return { data: { user: { id: 'new-sub-id' } }, error: null }
                },
                async deleteUser(userId: string) {
                    deleteUserCalls.push(userId)
                    if (config.deleteUserImpl) return config.deleteUserImpl(userId)
                    return { error: null }
                },
            },
        },
    }

    return { db, inserted, updated, createUserCalls, deleteUserCalls }
}

const VALID_INPUT = { name: 'Kofi Mensah', email: 'kofi@gmail.com', phone: '0241234567' }

// Shared deps for tests that reject BEFORE reaching delivery — delivery is
// never attempted on these paths, so a single shared fake is fine; no
// assertions here inspect smsCalls/emailCalls.
const { deps: NEUTRAL_DEPS } = fakeDeps()

async function main() {

    // ── Rule 2 (final-review C1): a plain customer caller is rejected — a
    //    DIFFERENT rejection than "already a sub" (no sub_agents row at all
    //    here; the caller is simply an ineligible role). This is the specific
    //    gap the final review found: before this fix, ANY authenticated user
    //    (not just subs) could create real Supabase Auth accounts through
    //    this endpoint. ──
    {
        const { db, createUserCalls } = fakeDb({
            users: [{ id: 'customerCaller', role: 'customer' }],
        })
        const r = await createSubAgent(db, 'customerCaller', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'a customer caller: creation rejected')
        assert(r.status === 403, 'a customer caller: rejected with 403')
        assert(r.error !== 'Sub-agent accounts cannot recruit others', 'a customer caller: rejection is NOT the "already a sub" message')
        assert(createUserCalls.length === 0, 'a customer caller: no account ever created')
    }

    // ── Rule 2: an admin caller is ALSO rejected — spec 2026-09-06 §3.2 says
    //    "role IN ('agent','dealer')" only; admin is deliberately excluded. ──
    {
        const { db, createUserCalls } = fakeDb({
            users: [{ id: 'adminCaller', role: 'admin' }],
        })
        const r = await createSubAgent(db, 'adminCaller', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'an admin caller: creation rejected')
        assert(r.status === 403, 'an admin caller: rejected with 403')
        assert(createUserCalls.length === 0, 'an admin caller: no account ever created')
    }

    // ── Rule 2: a role-'agent' caller whose agent membership has EXPIRED
    //    (not lifetime) is rejected — canOwnSubNetwork requires a LIFETIME
    //    agent (agent_expires_at IS NULL), matching resolveSubAgentContext's
    //    own recruiter-eligibility gate elsewhere in this codebase. ──
    {
        const { db, createUserCalls } = fakeDb({
            users: [{ id: 'expiredAgent', role: 'agent', agent_expires_at: '2020-01-01T00:00:00Z' }],
        })
        const r = await createSubAgent(db, 'expiredAgent', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'an expired-agent caller: creation rejected')
        assert(r.status === 403, 'an expired-agent caller: rejected with 403')
        assert(createUserCalls.length === 0, 'an expired-agent caller: no account ever created')
    }

    // ── Rule 3 (spec C1): a sub can never recruit ──
    {
        const { db, createUserCalls } = fakeDb({
            subAgents: [{ user_id: 'caller1', upline_user_id: null, status: 'active' }],
        })
        const r = await createSubAgent(db, 'caller1', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'a sub-agent caller: creation rejected')
        assert(r.status === 403, 'a sub-agent caller: rejected with 403')
        assert(createUserCalls.length === 0, 'a sub-agent caller: no account ever created')
    }

    // ── Rule 4: recruit cap ──
    {
        const { db, createUserCalls } = fakeDb({
            subAgents: [
                { user_id: 'sub1', upline_user_id: 'caller2', status: 'active' },
                { user_id: 'sub2', upline_user_id: 'caller2', status: 'active' },
            ],
            settings: [{ key: 'sub_agent_max_recruits', value: 2 }],
        })
        const r = await createSubAgent(db, 'caller2', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'recruiter at cap: creation rejected')
        assert(r.status === 403, 'recruiter at cap: rejected with 403')
        assert(createUserCalls.length === 0, 'recruiter at cap: no account ever created')
    }

    // ── Rule 4 (fail-fast on count-query error): a transient failure reading
    //    the sub_agents count must hard-fail with the same 500/generic message
    //    the pre-Task-4 inline cap check used to return — the sub_agents count
    //    IS the cap check's own input, so it is not safe to silently treat as
    //    used=0 and let creation proceed. (This is distinct from the
    //    shop_global_settings cap-VALUE lookup, which stays a safe,
    //    non-fatal fallback to DEFAULT_MAX_RECRUITS either way.) ──
    {
        const { db, createUserCalls } = fakeDb({
            countSubAgentsError: { message: 'db hiccup on sub_agents count' },
        })
        const r = await createSubAgent(db, 'caller2b', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'recruit-count query error: creation rejected')
        assert(r.status === 500, 'recruit-count query error: rejected with 500 (fail-fast, not silently used=0)')
        assert(r.error === 'Could not create sub-agent account', 'recruit-count query error: same generic message as any other 500')
        assert(createUserCalls.length === 0, 'recruit-count query error: no account ever created')
    }

    // ── Rule 4 (default cap): missing shop_global_settings row falls back to 5 ──
    {
        const { db } = fakeDb({
            subAgents: Array.from({ length: 5 }, (_, i) => ({
                user_id: `sub${i}`, upline_user_id: 'caller2b', status: 'active',
            })),
            settings: [], // no row at all — must fall back to 5, not crash or bypass the cap
        })
        const r = await createSubAgent(db, 'caller2b', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'missing settings row: still enforces default cap of 5')
        assert(r.status === 403, 'missing settings row: rejected with 403')
    }

    // ── Rule 5 (spec C12): duplicate EMAIL rejected with a message distinct
    //    from a duplicate-PHONE collision. Deliberate, scoped exception to the
    //    enumeration-avoidance policy used elsewhere (signup/login) — this is
    //    a recruiter-creates-a-known-person flow, so naming the colliding
    //    field leaks nothing exploitable here. ──
    let emailCollisionMessage = ''
    {
        const { db, createUserCalls } = fakeDb({
            users: [{ id: 'existing1', email: VALID_INPUT.email, phone_number: '0209999999' }],
        })
        const r = await createSubAgent(db, 'caller3', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'duplicate email: creation rejected')
        assert(r.status === 400, 'duplicate email: rejected with 400')
        assert(createUserCalls.length === 0, 'duplicate email: no account ever created')
        emailCollisionMessage = r.error ?? ''
        assert(emailCollisionMessage === 'An account with this email already exists.', 'duplicate email: distinct email-collision message')
    }

    // ── Rule 5 (spec C12): duplicate PHONE rejected with a DIFFERENT message
    //    than the email collision above (no longer the same generic string). ──
    let phoneCollisionMessage = ''
    {
        const { db, createUserCalls } = fakeDb({
            users: [{ id: 'existing2', email: 'someoneelse@example.com', phone_number: '0241234567' }],
        })
        const r = await createSubAgent(db, 'caller4', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'duplicate phone: creation rejected')
        assert(r.status === 400, 'duplicate phone: rejected with 400')
        assert(createUserCalls.length === 0, 'duplicate phone: no account ever created')
        phoneCollisionMessage = r.error ?? ''
        assert(phoneCollisionMessage === 'An account with this phone number already exists.', 'duplicate phone: distinct phone-collision message')
        assert(
            phoneCollisionMessage !== emailCollisionMessage,
            `duplicate phone: message DIFFERS from the email-collision message — got "${phoneCollisionMessage}" vs "${emailCollisionMessage}"`,
        )
        assert(
            phoneCollisionMessage !== 'You have reached your recruit limit' && emailCollisionMessage !== 'You have reached your recruit limit',
            'duplicate email/phone: neither collision message matches the cap-exceeded rejection message',
        )
    }

    // ── Rule 6: a healthy recruiter under the cap succeeds ──
    {
        const { db, inserted, updated, createUserCalls } = fakeDb({})
        const { deps, smsCalls, emailCalls } = fakeDeps()
        const r = await createSubAgent(db, 'caller5', VALID_INPUT, deps)

        assert(r.success === true, 'healthy recruiter: creation succeeds')
        assert(r.status === 200, 'healthy recruiter: 200 status')
        assert(!!r.subAgent && r.subAgent.id === 'new-sub-id', 'healthy recruiter: subAgent.id is the new auth user id')
        assert(r.subAgent?.name === VALID_INPUT.name, 'healthy recruiter: subAgent.name echoes input')
        assert(r.subAgent?.email === VALID_INPUT.email, 'healthy recruiter: subAgent.email echoes input')
        assert((r as any).accessKey === undefined, 'healthy recruiter: result has no accessKey field at all')
        assert(r.deliveryStatus?.smsDelivered === true, 'healthy recruiter: sms delivery attempted and reported')
        assert(r.deliveryStatus?.emailDelivered === true, 'healthy recruiter: email delivery attempted and reported')
        assert(!JSON.stringify(r).match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/), 'healthy recruiter: no key-shaped string anywhere in the result')

        assert(createUserCalls.length === 1, 'healthy recruiter: exactly one Admin API createUser call')
        assert(createUserCalls[0].email === VALID_INPUT.email, 'healthy recruiter: createUser called with the validated email')
        assert(createUserCalls[0].email_confirm === true, 'healthy recruiter: email_confirm true (no confirmation email needed)')

        const subAgentInsert = inserted.find((i) => i.table === 'sub_agents')
        assert(!!subAgentInsert, 'healthy recruiter: a sub_agents row is inserted')
        assert(subAgentInsert?.payload.user_id === 'new-sub-id', 'healthy recruiter: sub_agents.user_id is the new user')
        assert(subAgentInsert?.payload.upline_user_id === 'caller5', 'healthy recruiter: sub_agents.upline_user_id is the recruiter')
        assert(subAgentInsert?.payload.status === 'active', "healthy recruiter: sub_agents.status is 'active' (no approval step)")
        assert(subAgentInsert?.payload.must_change_password === true, 'healthy recruiter: sub_agents.must_change_password is true')

        const roleUpdate = updated.find((u) => u.table === 'users' && u.col === 'id' && u.val === 'new-sub-id')
        assert(!!roleUpdate, 'healthy recruiter: a users row UPDATE targets the new user by id')
        assert(roleUpdate?.payload.role === 'subagent', "healthy recruiter: role is set to 'subagent'")

        assert(smsCalls.length === 1, 'healthy recruiter: exactly one SMS send')
        assert(smsCalls[0].recipient === '0241234567', 'healthy recruiter: SMS sent to the newly validated phone')
        assert(emailCalls.length === 1, 'healthy recruiter: exactly one email send')
        assert(emailCalls[0].to === VALID_INPUT.email, 'healthy recruiter: email sent to the newly validated email')
    }

    // ── Rule 6 continued: the plaintext access key IS genuinely the same
    //    value persisted as the Supabase Auth password AND the same value
    //    delivered via SMS/email (round-tripped through
    //    hashAccessKey/verifyAccessKey, not just string equality) — and it
    //    NEVER appears anywhere in the returned result. ──
    {
        const { db, createUserCalls } = fakeDb({})
        const { deps, smsCalls } = fakeDeps()
        const r = await createSubAgent(db, 'caller6', VALID_INPUT, deps)

        assert(r.success === true, 'accessKey persistence: creation succeeds')
        const persistedPlaintext = createUserCalls[0]?.password

        const smsMsg: string = smsCalls[0]?.message ?? ''
        const plaintextCandidates = smsMsg.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/g) ?? []
        assert(plaintextCandidates.length === 1, 'accessKey persistence: SMS body contains exactly one key-shaped token')
        const deliveredPlaintext = plaintextCandidates[0]
        assert(persistedPlaintext === deliveredPlaintext, 'accessKey persistence: password passed to createUser equals the key delivered via SMS')

        const hash = await hashAccessKey(persistedPlaintext)
        assert(await verifyAccessKey(persistedPlaintext, hash), 'accessKey persistence: hashing the delivered key verifies against the persisted plaintext')
        assert(!(await verifyAccessKey('WRONG-WRONG-WRON', hash)), 'accessKey persistence: a different key does not verify')

        assert(!JSON.stringify(r).includes(persistedPlaintext), 'accessKey persistence: the plaintext key NEVER appears in the returned result')
    }

    // ── Task 3: creation delivers the key to the SUB, never the recruiter —
    //    no accessKey field at all, deliveryStatus reported instead. ──
    {
        const { db } = fakeDb({})
        const { deps } = fakeDeps()
        const r: any = await createSubAgent(db, 'recruiter-1', VALID_INPUT, deps)
        assert(r.success === true, 'creation succeeds')
        assert(r.accessKey === undefined, 'result has no accessKey field at all')
        assert(!JSON.stringify(r).match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/), 'no key-shaped string anywhere in the result')
        assert(r.deliveryStatus?.smsDelivered === true, 'sms delivery attempted and reported')
        assert(r.deliveryStatus?.emailDelivered === true, 'email delivery attempted and reported')
    }

    // ── Task 3: the inserted sub_agents row always sets must_change_password ──
    {
        const { db, inserted } = fakeDb({})
        const { deps } = fakeDeps()
        await createSubAgent(db, 'recruiter-1', { name: 'Ama Owusu', email: 'ama2@gmail.com', phone: '0501234567' }, deps)
        const subAgentInsert = inserted.find((i) => i.table === 'sub_agents')
        assert(subAgentInsert?.payload.must_change_password === true, 'inserted sub_agents row has must_change_password: true')
    }

    // ── Task 3: delivery failures don't fail the whole creation — the account
    //    still exists and is usable via password reset/support, mirroring
    //    regenerateSubAgentKey's own best-effort delivery semantics. ──
    {
        const { db } = fakeDb({})
        const { deps } = fakeDeps({ smsResult: { success: false, error: 'provider down' } })
        const r = await createSubAgent(db, 'caller12', VALID_INPUT, deps)
        assert(r.success === true, 'SMS delivery failure: creation still reports success')
        assert(r.deliveryStatus?.smsDelivered === false, 'SMS delivery failure: reported as not delivered')
        assert(r.deliveryStatus?.emailDelivered === true, 'SMS delivery failure: email delivery unaffected')
    }

    // ── Failure path: Admin API createUser errors → generic failure, no partial writes ──
    {
        const { db, inserted, updated, deleteUserCalls } = fakeDb({
            createUserImpl: async () => ({ data: null, error: { message: 'admin api down' } }),
        })
        const r = await createSubAgent(db, 'caller7', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'Admin API failure: creation reported as failed')
        assert(r.status === 500, 'Admin API failure: 500 status')
        assert(inserted.length === 0, 'Admin API failure: no sub_agents row inserted')
        assert(updated.length === 0, 'Admin API failure: no role update attempted')
        assert(deleteUserCalls.length === 0, 'Admin API failure: no compensation needed — no account was ever created')
    }

    // ── Failure path: Admin API rejects with email_exists (root cause,
    //    2026-09-29) → a SPECIFIC "already exists" message, not the generic
    //    failure. This happens when auth.users already holds the email but
    //    public.users doesn't (an orphaned Auth account from some earlier,
    //    unrelated failure) — Rule 5's own uniqueness pre-check only queries
    //    public.users, so it cannot catch this case ahead of time; the real
    //    Supabase Auth call is the only place that can. ──
    {
        const { db, inserted, updated, deleteUserCalls } = fakeDb({
            createUserImpl: async () => ({
                data: null,
                error: { message: 'A user with this email address has already been registered', code: 'email_exists', status: 422 },
            }),
        })
        const r = await createSubAgent(db, 'caller7b', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'email_exists: creation reported as failed')
        assert(r.status === 400, 'email_exists: 400 status (caller-fixable input, not a server error)')
        assert(r.error === 'An account with this email already exists.', 'email_exists: same specific message as the public.users pre-check, not the generic failure')
        assert(inserted.length === 0, 'email_exists: no sub_agents row inserted')
        assert(updated.length === 0, 'email_exists: no role update attempted')
        assert(deleteUserCalls.length === 0, 'email_exists: no compensation needed — no account was ever created')
    }

    // ── Compensation: sub_agents insert fails AFTER createUser already
    //    succeeded → the orphaned auth account must be deleted, not left
    //    behind permanently occupying the email/phone. ──
    {
        const { db, deleteUserCalls, updated } = fakeDb({
            insertSubAgentError: { message: 'db hiccup on sub_agents insert' },
        })
        const r = await createSubAgent(db, 'caller9', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'sub_agents insert failure: creation reported as failed')
        assert(r.status === 500, 'sub_agents insert failure: 500 status')
        assert(updated.length === 0, 'sub_agents insert failure: role update never attempted')
        assert(deleteUserCalls.length === 1, 'sub_agents insert failure: compensating deleteUser called exactly once')
        assert(deleteUserCalls[0] === 'new-sub-id', 'sub_agents insert failure: deleteUser called with the orphaned account\'s id')
    }

    // ── Compensation: role='subagent' update fails AFTER createUser AND the
    //    sub_agents insert already succeeded → same cleanup requirement. ──
    {
        const { db, deleteUserCalls, inserted } = fakeDb({
            updateUserError: { message: 'db hiccup on role update' },
        })
        const r = await createSubAgent(db, 'caller10', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'role update failure: creation reported as failed')
        assert(r.status === 500, 'role update failure: 500 status')
        assert(inserted.some((i) => i.table === 'sub_agents'), 'role update failure: sub_agents row WAS inserted before the failure')
        assert(deleteUserCalls.length === 1, 'role update failure: compensating deleteUser called exactly once')
        assert(deleteUserCalls[0] === 'new-sub-id', 'role update failure: deleteUser called with the orphaned account\'s id')
    }

    // ── I3 race backstop: the DB trigger's cap-exceeded literal (thrown when
    //    two concurrent requests both pass the app-level pre-check and the
    //    trigger's own atomic re-check then rejects the second insert) maps
    //    to the SAME friendly 403 message as the fast pre-check, not the
    //    generic 500 failure — and still compensates the orphaned account. ──
    {
        const { db, deleteUserCalls } = fakeDb({
            insertSubAgentError: { message: 'SUB_AGENT_RECRUIT_CAP_EXCEEDED' },
        })
        const r = await createSubAgent(db, 'callerRace', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'recruit-cap race: creation rejected')
        assert(r.status === 403, 'recruit-cap race: rejected with 403 (not 500)')
        assert(r.error === 'You have reached your recruit limit', 'recruit-cap race: same friendly message as the fast pre-check')
        assert(deleteUserCalls.length === 1, 'recruit-cap race: compensating deleteUser still called')
        assert(deleteUserCalls[0] === 'new-sub-id', 'recruit-cap race: deleteUser called with the orphaned account\'s id')
    }

    // ── Compensation is best-effort: a deleteUser failure must not crash the
    //    response path or change the error returned to the caller. ──
    {
        const { db, deleteUserCalls } = fakeDb({
            insertSubAgentError: { message: 'db hiccup on sub_agents insert' },
            deleteUserImpl: async () => ({ error: { message: 'delete also failed' } }),
        })
        const r = await createSubAgent(db, 'caller11', VALID_INPUT, NEUTRAL_DEPS)
        assert(r.success === false, 'compensation-also-fails: still reports the ORIGINAL failure, not a crash')
        assert(r.status === 500, 'compensation-also-fails: still 500 status')
        assert(r.error === 'Could not create sub-agent account', 'compensation-also-fails: same generic 500 error message as any other creation failure')
        assert(deleteUserCalls.length === 1, 'compensation-also-fails: deleteUser was still attempted')
    }

    // ── Input validation: invalid phone rejected before any DB writes ──
    {
        const { db, createUserCalls } = fakeDb({})
        const r = await createSubAgent(db, 'caller8', { ...VALID_INPUT, phone: '123' }, NEUTRAL_DEPS)
        assert(r.success === false, 'invalid phone: creation rejected')
        assert(r.status === 400, 'invalid phone: 400 status')
        assert(createUserCalls.length === 0, 'invalid phone: no account ever created')
    }

    // ── GET shape: listSubAgents returns exactly {id, name, email, phone, status, created_at} ──
    {
        const { db } = fakeDb({
            subAgents: [
                { user_id: 'subA', upline_user_id: 'lead1', status: 'active', created_at: '2026-09-10T00:00:00Z' },
                { user_id: 'subB', upline_user_id: 'lead1', status: 'suspended', created_at: '2026-09-12T00:00:00Z' },
            ],
            users: [
                { id: 'subA', first_name: 'Ama', last_name: 'Owusu', email: 'ama@example.com', phone_number: '0241111111' },
                { id: 'subB', first_name: 'Kwesi', last_name: '', email: 'kwesi@example.com', phone_number: '0242222222' },
            ],
        })
        const r = await listSubAgents(db, 'lead1')
        assert(r.success === true, 'listSubAgents: succeeds')
        assert(r.subAgents?.length === 2, 'listSubAgents: returns exactly the caller\'s downline (2 rows)')
        const subA = r.subAgents?.find((s) => s.id === 'subA')
        assert(subA?.name === 'Ama Owusu', 'listSubAgents: name is first_name + last_name')
        assert(subA?.email === 'ama@example.com', 'listSubAgents: email present')
        assert(subA?.phone === '0241111111', 'listSubAgents: phone present')
        assert(subA?.status === 'active', 'listSubAgents: status present')
        assert(subA?.created_at === '2026-09-10T00:00:00Z', 'listSubAgents: created_at present')
        const subB = r.subAgents?.find((s) => s.id === 'subB')
        assert(subB?.name === 'Kwesi', 'listSubAgents: trims a blank last_name cleanly')
    }

    // ── GET shape: a recruiter with no downline gets an empty array, not an error ──
    {
        const { db } = fakeDb({ subAgents: [] })
        const r = await listSubAgents(db, 'lonelyLead')
        assert(r.success === true, 'listSubAgents: empty downline still succeeds')
        assert(Array.isArray(r.subAgents) && r.subAgents.length === 0, 'listSubAgents: empty downline returns []')
    }

    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(fail > 0 ? 1 : 0)
}

main()
