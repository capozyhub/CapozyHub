// scripts/test-retry-concurrency.ts
// Manual/CI-optional verification that claim_order_retry is a genuine single-flight
// lock: two simultaneous calls against the SAME order must resolve to exactly one
// winner. Requires real Supabase credentials in env (SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_URL) and a throwaway 'failed' order row — this script creates
// and cleans up its own test order rather than touching real data.
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function assertOk(condition: boolean, label: string) {
    if (condition) {
        console.log(`PASS: ${label}`)
    } else {
        console.error(`FAIL: ${label}`)
        process.exitCode = 1
    }
}

async function main() {
    const testOrderId = randomUUID()
    const testUserId = process.env.TEST_ADMIN_USER_ID
    if (!testUserId) {
        console.error('FAIL: set TEST_ADMIN_USER_ID env var to a real admin user id before running this script')
        process.exit(1)
    }

    const { error: insertErr } = await supabase.from('orders').insert({
        id: testOrderId,
        user_id: testUserId,
        phone_number: '0551234567',
        network: 'MTN',
        size: '1GB',
        price: 5,
        status: 'failed',
        payment_status: 'paid',
        reference_code: `TEST-RETRY-${testOrderId.slice(0, 8)}`,
        category: 'data',
        source: 'web',
    })
    if (insertErr) {
        console.error('FAIL: could not create test order:', insertErr.message)
        process.exit(1)
    }

    try {
        const [r1, r2] = await Promise.all([
            supabase.rpc('claim_order_retry', {
                p_order_id: testOrderId, p_actor_id: testUserId, p_actor_role: 'admin',
                p_charge_amount: 0, p_reference_code: null, p_cost_price: null,
            }),
            supabase.rpc('claim_order_retry', {
                p_order_id: testOrderId, p_actor_id: testUserId, p_actor_role: 'admin',
                p_charge_amount: 0, p_reference_code: null, p_cost_price: null,
            }),
        ])

        const results = [r1.data, r2.data]
        const winners = results.filter((r: any) => r?.ok === true)
        const losers = results.filter((r: any) => r?.ok === false)

        assertOk(
            winners.length === 1 && losers.length === 1,
            'exactly one of two concurrent claim_order_retry calls won'
        )
        if (!(winners.length === 1 && losers.length === 1)) {
            console.error(`  expected exactly 1 winner and 1 loser, got ${winners.length} winners, ${losers.length} losers`, results)
        }

        const { data: finalOrder } = await supabase.from('orders').select('retry_count').eq('id', testOrderId).single()
        assertOk(
            finalOrder?.retry_count === 1,
            'retry_count incremented exactly once'
        )
        if (finalOrder?.retry_count !== 1) {
            console.error(`  expected retry_count=1, got ${finalOrder?.retry_count}`)
        }
    } finally {
        await supabase.from('orders').delete().eq('id', testOrderId)
    }

    if (process.exitCode === 1) {
        console.error('\nSome tests failed.')
    } else {
        console.log('\nAll tests passed.')
    }
}

main()
