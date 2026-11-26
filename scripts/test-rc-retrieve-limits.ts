// scripts/test-rc-retrieve-limits.ts
//
// The voucher PIN retrieval limits must be spent by failed lookups only. If a peek counted,
// or a success counted, anyone who knew a buyer's phone could exhaust that buyer's budget
// and lock them out of the voucher they paid for. Runs on the per-instance fallback
// (no Redis env), which uses the same bucket semantics.
import { isDistributedBlocked, limitDistributed } from '@/lib/distributed-rate-limit'

function check(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

async function main() {
    const bucket = 'test-rc-retrieve-phone'
    const id = '0241234567'

    // Peeking, however often, never spends the budget.
    for (let i = 0; i < 50; i++) check(await isDistributedBlocked(bucket, id, 3, 3600), false, `peek #${i} must not count`)

    // Failed lookups spend it: three are allowed, then the bucket is full.
    for (let i = 0; i < 3; i++) check((await limitDistributed(bucket, id, 3, 3600)).allowed, true, `failure #${i + 1} counted`)
    check(await isDistributedBlocked(bucket, id, 3, 3600), true, 'blocked after the budget is spent')

    // Another identifier is unaffected: one attacker's IP+phone bucket is not another IP's.
    check(await isDistributedBlocked(bucket, '1.2.3.4:0241234567', 3, 3600), false, 'other identifier untouched')
    check(await isDistributedBlocked('other-bucket', id, 3, 3600), false, 'other bucket untouched')

    console.log('rc-retrieve limits: ok')
}

main().catch(e => { console.error(e); process.exit(1) })
