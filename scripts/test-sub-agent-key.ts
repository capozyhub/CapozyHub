// scripts/test-sub-agent-key.ts
import {
    generateAccessKey,
    hashAccessKey,
    verifyAccessKey,
    beginRegenerate,
    tryPromotePendingKey,
} from '../lib/sub-agent-key'

let pass = 0, fail = 0
function assert(cond: boolean, msg: string) {
    if (cond) { console.log(`PASS: ${msg}`); pass++ }
    else { console.error(`FAIL: ${msg}`); fail++ }
}

// ── Fake db: supports the .from().update().eq() and .from().select().eq().maybeSingle()
// chains beginRegenerate/tryPromotePendingKey actually call, mirroring the hand-rolled
// fake-SupabaseClient pattern in scripts/test-sub-agent-account.ts /
// scripts/test-sub-agent-earnings.ts — no real database connection.
function fakeDb(opts: { row?: any; updateError?: any } = {}) {
    const updates: any[] = []
    const db = {
        from(_table: string) {
            return {
                select(_cols: string) {
                    return {
                        eq(_col: string, _val: any) {
                            return {
                                async maybeSingle() {
                                    return { data: opts.row ?? null, error: null }
                                },
                            }
                        },
                    }
                },
                update(payload: any) {
                    updates.push(payload)
                    return {
                        eq(_col: string, _val: any) {
                            return Promise.resolve({ error: opts.updateError ?? null })
                        },
                    }
                },
            }
        },
    } as any
    return { db, updates }
}

function fakeAdminAuthClient(opts: { updateError?: any } = {}) {
    const calls: any[] = []
    const client = {
        auth: {
            admin: {
                async updateUserById(userId: string, payload: any) {
                    calls.push({ userId, payload })
                    return { error: opts.updateError ?? null }
                },
            },
        },
    } as any
    return { client, calls }
}

async function main() {

    // ── Pure logic: key generation, hashing, verification ──
    const key = generateAccessKey()
    assert(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key), 'key matches XXXX-XXXX-XXXX shape')
    assert(generateAccessKey() !== generateAccessKey(), 'two calls produce different keys')

    const hash = await hashAccessKey(key)
    assert(hash !== key, 'hash is not the plaintext key')
    assert(await verifyAccessKey(key, hash), 'correct key verifies against its own hash')
    assert(!(await verifyAccessKey('WRONG-WRONG-WRON', hash)), 'wrong key fails verification')

    // ── beginRegenerate ──
    {
        const { db, updates } = fakeDb()
        const r = await beginRegenerate(db, 'kofi')
        assert(r.success === true, 'beginRegenerate: reports success')
        assert(typeof r.plaintextKey === 'string' && /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(r.plaintextKey!), 'beginRegenerate: returns a plaintext key in the right shape')
        assert(updates.length === 1, 'beginRegenerate: writes exactly one update')
        assert(typeof updates[0].pending_key_hash === 'string' && updates[0].pending_key_hash !== r.plaintextKey, 'beginRegenerate: stores a hash, never the plaintext')
        assert(typeof updates[0].pending_key_expires_at === 'string', 'beginRegenerate: sets an expiry timestamp')
        const expiresAtMs = new Date(updates[0].pending_key_expires_at).getTime()
        const expectedMs = Date.now() + 2 * 60 * 60 * 1000
        assert(Math.abs(expiresAtMs - expectedMs) < 5000, 'beginRegenerate: expiry is ~2 hours out')
        assert(await verifyAccessKey(r.plaintextKey!, updates[0].pending_key_hash), 'beginRegenerate: stored hash matches the returned plaintext')
    }

    {
        const { db } = fakeDb({ updateError: { code: '42501', message: 'permission denied' } })
        const r = await beginRegenerate(db, 'kofi')
        assert(r.success === false, 'beginRegenerate: a real DB error is surfaced as failure')
        assert(r.plaintextKey === undefined, 'beginRegenerate: no plaintext leaks out on failure')
    }

    // ── tryPromotePendingKey ──
    {
        const { db } = fakeDb({ row: null })
        const { client } = fakeAdminAuthClient()
        const ok = await tryPromotePendingKey(db, client, 'kofi', 'anything')
        assert(ok === false, 'tryPromotePendingKey: no sub_agents row -> false')
    }

    {
        const { db } = fakeDb({ row: { pending_key_hash: null, pending_key_expires_at: null } })
        const { client } = fakeAdminAuthClient()
        const ok = await tryPromotePendingKey(db, client, 'kofi', 'anything')
        assert(ok === false, 'tryPromotePendingKey: no pending key on the row -> false')
    }

    {
        const pendingKey = 'ABCD-EFGH-1234'
        const pendingHash = await hashAccessKey(pendingKey)
        const expiredAt = new Date(Date.now() - 60_000).toISOString() // 1 minute in the past
        const { db } = fakeDb({ row: { pending_key_hash: pendingHash, pending_key_expires_at: expiredAt } })
        const { client, calls } = fakeAdminAuthClient()
        const ok = await tryPromotePendingKey(db, client, 'kofi', pendingKey)
        assert(ok === false, 'tryPromotePendingKey: expired pending key -> false')
        assert(calls.length === 0, 'tryPromotePendingKey: expired key never touches Admin API')
    }

    {
        const pendingKey = 'ABCD-EFGH-1234'
        const pendingHash = await hashAccessKey(pendingKey)
        const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        const { db } = fakeDb({ row: { pending_key_hash: pendingHash, pending_key_expires_at: futureExpiry } })
        const { client, calls } = fakeAdminAuthClient()
        const ok = await tryPromotePendingKey(db, client, 'kofi', 'WRONG-WRONG-WRON')
        assert(ok === false, 'tryPromotePendingKey: mismatched submitted password -> false')
        assert(calls.length === 0, 'tryPromotePendingKey: mismatch never touches Admin API')
    }

    {
        const pendingKey = 'ABCD-EFGH-1234'
        const pendingHash = await hashAccessKey(pendingKey)
        const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        const { db, updates } = fakeDb({ row: { pending_key_hash: pendingHash, pending_key_expires_at: futureExpiry } })
        const { client, calls } = fakeAdminAuthClient()
        const ok = await tryPromotePendingKey(db, client, 'kofi', pendingKey)
        assert(ok === true, 'tryPromotePendingKey: matching non-expired key -> true')
        assert(calls.length === 1 && calls[0].userId === 'kofi' && calls[0].payload.password === pendingKey, 'tryPromotePendingKey: calls updateUserById with the submitted password')
        assert(updates.length === 1 && updates[0].pending_key_hash === null && updates[0].pending_key_expires_at === null, 'tryPromotePendingKey: clears pending columns after promotion')
    }

    {
        const pendingKey = 'ABCD-EFGH-1234'
        const pendingHash = await hashAccessKey(pendingKey)
        const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        const { db, updates } = fakeDb({ row: { pending_key_hash: pendingHash, pending_key_expires_at: futureExpiry } })
        const { client } = fakeAdminAuthClient({ updateError: { message: 'admin api down' } })
        const ok = await tryPromotePendingKey(db, client, 'kofi', pendingKey)
        assert(ok === false, 'tryPromotePendingKey: Admin API failure -> false')
        assert(updates.length === 0, 'tryPromotePendingKey: never clears pending columns when promotion itself failed')
    }

    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(fail > 0 ? 1 : 0)
}
main()
