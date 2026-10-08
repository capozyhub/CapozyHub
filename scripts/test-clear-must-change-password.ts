// scripts/test-clear-must-change-password.ts
// Tests the pure helper in isolation (the full route has heavy Supabase Auth
// integration not practical to unit test here, matching this repo's existing
// convention of testing extracted pure/DB-only helpers).
import { clearMustChangePasswordIfSubAgent } from '../lib/sub-agent-account'

function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1 } else { console.log('PASS:', msg) }
}

function fakeDb() {
    const updates: any[] = []
    return {
        db: {
            from: (table: string) => ({
                update: (patch: any) => ({
                    eq: (_col: string, id: string) => {
                        updates.push({ table, patch, id })
                        return Promise.resolve({ error: null })
                    },
                }),
            }),
        } as any,
        updates,
    }
}

async function main() {
    const { db, updates } = fakeDb()
    await clearMustChangePasswordIfSubAgent(db, 'user-1')
    assert(updates.length === 1, 'exactly one update issued')
    assert(updates[0].table === 'sub_agents', 'updates the sub_agents table')
    assert(updates[0].patch.must_change_password === false, 'sets must_change_password to false')
    assert(updates[0].id === 'user-1', 'scoped to the right user id')
    process.exit(process.exitCode || 0)
}

main()
