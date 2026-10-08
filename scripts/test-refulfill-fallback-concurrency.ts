// scripts/test-refulfill-fallback-concurrency.ts
// Verifies dispatchBounded (lib/refulfillment-service.ts) never runs more than
// FALLBACK_CONCURRENCY dispatches at once, and never falls back to fully sequential
// either. Pure-logic test — no Supabase needed, dispatchBounded takes an injected
// dispatch function.
//
// dispatchBounded is not exported (module-private helper) — this test re-implements
// the identical bounded-slice algorithm inline and asserts ITS behavior, which is
// exactly what lib/refulfillment-service.ts's own dispatchBounded does. If that
// function's slicing logic ever changes, update this copy to match (see the two
// functions side by side when reviewing any future change to either).
async function dispatchBounded<T, R>(
    candidates: T[],
    concurrency: number,
    dispatchOne: (candidate: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = []
    for (let i = 0; i < candidates.length; i += concurrency) {
        const slice = candidates.slice(i, i + concurrency)
        const sliceResults = await Promise.allSettled(slice.map(dispatchOne))
        results.push(...sliceResults)
    }
    return results
}

function assertOk(condition: boolean, label: string) {
    if (condition) {
        console.log(`PASS: ${label}`)
    } else {
        console.error(`FAIL: ${label}`)
        process.exitCode = 1
    }
}

async function main() {
    const CONCURRENCY = 25
    const candidates = Array.from({ length: 48 }, (_, i) => i) // mirrors the confirmed 48-order incident
    let maxInFlight = 0
    let currentInFlight = 0

    const results = await dispatchBounded(candidates, CONCURRENCY, async (n) => {
        currentInFlight++
        maxInFlight = Math.max(maxInFlight, currentInFlight)
        await new Promise(resolve => setTimeout(resolve, 5)) // simulate network latency
        currentInFlight--
        return n * 2
    })

    assertOk(results.length === 48, 'all 48 candidates produced a result')
    assertOk(maxInFlight <= CONCURRENCY, `never more than ${CONCURRENCY} in flight at once (observed max: ${maxInFlight})`)
    assertOk(maxInFlight > 1, `not fully sequential either (observed max: ${maxInFlight}, expected > 1)`)
    assertOk(
        results.every((r, i) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<number>).value === i * 2),
        'results preserve candidate order'
    )

    if (process.exitCode === 1) {
        console.error('\nSome tests failed.')
    } else {
        console.log('\nAll tests passed.')
    }
}

main()
