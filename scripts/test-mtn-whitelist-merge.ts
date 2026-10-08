// scripts/test-mtn-whitelist-merge.ts
// Pure tests for the gate's verdict rule (combineServerVerdicts). No network. Needs
// --env-file=.env.local because the module imports the Supabase client at load time.
//
// verdicts[i] = what ACTIVE server i said: number -> allowed, or null if it could not answer.
import { combineServerVerdicts } from '../lib/mtn-whitelist-merge'

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

const N = '0241000001'
const row = (allowed: boolean) => [{ input: N, normalized: N, allowed }]
const m = (allowed: boolean) => new Map([[N, allowed]])

// One active server: its answer is the answer.
assertEqual(combineServerVerdicts([N], [m(true)]), row(true), 'only Server 1 active, registered there -> allowed')
assertEqual(combineServerVerdicts([N], [m(false)]), row(false), 'only Server 1 active, not registered -> blocked')

// THE REPORTED BUG: only Server 2 active, number registered on Server 1 only. Server 1 is not
// consulted (it is not active), Server 2 says no -> must be blocked.
assertEqual(combineServerVerdicts([N], [m(false)]), row(false), 'only Server 2 active, registered only on Server 1 -> blocked')
assertEqual(combineServerVerdicts([N], [m(true)]), row(true), 'only Server 2 active, registered there -> allowed')

// Both active: registered on either passes.
assertEqual(combineServerVerdicts([N], [m(true), new Map()]), row(true), 'both active, Server 1 allows (Server 2 never asked) -> allowed')
assertEqual(combineServerVerdicts([N], [m(false), m(true)]), row(true), 'both active, only Server 2 allows -> allowed')
assertEqual(combineServerVerdicts([N], [m(false), m(false)]), row(false), 'both active, neither allows -> blocked')

// A server that could not answer never produces a block — the number is left out (callers fail open).
assertEqual(combineServerVerdicts([N], [null, m(false)]), [], 'both active, Server 1 errored, Server 2 says no -> unknown, never guessed')
assertEqual(combineServerVerdicts([N], [null, m(true)]), row(true), 'both active, Server 1 errored, Server 2 allows -> allowed')
assertEqual(combineServerVerdicts([N], [null]), [], 'only server errored -> unknown')
assertEqual(combineServerVerdicts([N], [new Map()]), [], 'server returned no row for the number -> unknown')

// Order is preserved across a mixed batch.
const A = '0241000002', B = '0241000003', C = '0241000004'
assertEqual(
    combineServerVerdicts([A, B, C], [new Map([[A, true], [B, false]]), new Map([[B, false]])]).map(r => `${r.normalized}:${r.allowed}`),
    [`${A}:true`, `${B}:false`],
    'mixed batch keeps input order and drops the unanswered number',
)
