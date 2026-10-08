// scripts/test-sub-agent-must-change-password.ts
// Tests the pure lookup helper used by both login and the dashboard layout
// gate (a later task) — see lib/sub-agent-account.ts.
import { fetchMustChangePassword } from '../lib/sub-agent-account'

function assert(cond: boolean, msg: string) {
    if (!cond) { console.error('FAIL:', msg); process.exitCode = 1 } else { console.log('PASS:', msg) }
}

function fakeDb(mustChange: boolean | null) {
    return {
        from: (table: string) => {
            if (table !== 'sub_agents') throw new Error(`unexpected table ${table}`)
            return {
                select: () => ({
                    eq: () => ({
                        maybeSingle: async () => ({ data: mustChange === null ? null : { must_change_password: mustChange }, error: null }),
                    }),
                }),
            }
        },
    } as any
}

async function main() {
    assert((await fetchMustChangePassword(fakeDb(true), 'user-1')) === true, 'flagged sub -> true')
    assert((await fetchMustChangePassword(fakeDb(false), 'user-1')) === false, 'cleared sub -> false')
    assert((await fetchMustChangePassword(fakeDb(null), 'user-1')) === false, 'non-sub (no row) -> false, never blocks a non-subagent')
    process.exit(process.exitCode || 0)
}

main()
