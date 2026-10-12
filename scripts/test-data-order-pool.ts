// scripts/test-data-order-pool.ts
//
// Bulk dispatch runs inside a 60s function. mapWithLimit has to cap how many supplier calls
// are in flight, survive one of them throwing, and stop starting new ones at the deadline so
// the admin alert can name every order it never reached.
import { mapWithLimit } from '@/lib/data-orders/pool'

function check(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
    // ── Never more than `limit` in flight; results stay in input order ─────────
    let inFlight = 0
    let peak = 0
    const items = Array.from({ length: 50 }, (_, i) => i)
    const res = await mapWithLimit(items, 7, async n => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await sleep(5)
        inFlight--
        return n * 2
    })
    check(peak <= 7, true, `peak in flight ${peak} must not exceed 7`)
    check(peak > 1, true, 'actually runs in parallel')
    check(res.every((r, i) => r.state === 'done' && r.value === i * 2), true, 'order preserved')

    // ── One failure does not stop the rest, and is reported as an error ────────
    const mixed = await mapWithLimit([1, 2, 3, 4], 2, async n => {
        if (n === 2) throw new Error('supplier down')
        return n
    })
    check(mixed[0].state, 'done', 'item 1 done')
    check(mixed[1].state, 'error', 'item 2 errored')
    check(mixed[2].state, 'done', 'item 3 still ran')
    check(mixed[3].state, 'done', 'item 4 still ran')

    // ── Past the deadline nothing new starts; the rest are named not-started ───
    const started: number[] = []
    const late = await mapWithLimit([0, 1, 2, 3, 4, 5], 2, async n => {
        started.push(n)
        await sleep(30)
        return n
    }, Date.now() + 40)
    const notStarted = late.filter(r => r.state === 'not-started').length
    check(notStarted > 0, true, 'some items were not started after the deadline')
    check(late.filter(r => r.state === 'done').length, started.length, 'every started item finished')
    check(late.filter(r => r.state === 'done').length + notStarted, 6, 'every item is accounted for')

    // ── An already-passed deadline starts nothing ──────────────────────────────
    const none = await mapWithLimit([1, 2, 3], 3, async n => n, Date.now() - 1)
    check(none.every(r => r.state === 'not-started'), true, 'expired deadline starts nothing')

    // ── Empty input ────────────────────────────────────────────────────────────
    check((await mapWithLimit([], 5, async n => n)).length, 0, 'empty')

    console.log('data-order pool: ok')
}

main().catch(e => { console.error(e); process.exit(1) })
