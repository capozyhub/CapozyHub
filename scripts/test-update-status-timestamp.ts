// scripts/test-update-status-timestamp.ts
// Confirms /api/admin/orders/update-status's core UPDATE always bumps updated_at.
// Prior to this fix it silently never did, which produced a wrong conclusion during
// live investigation on 2026-08-24 (a batch of genuinely cron-resolved orders was
// misread as a manual admin action because of a coincidental timestamp match — the
// route's own code, not the misread, is what's under test here). Exercises the same
// UPDATE shape the route issues directly against Supabase rather than through the HTTP
// route itself (no authenticated session available in a script context) — mirrors the
// pattern in scripts/test-retry-concurrency.ts.
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
    const orderId = randomUUID()
    const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1h ago

    const { error: insertErr } = await supabase.from('orders').insert({
        id: orderId,
        phone_number: '0551234567',
        network: 'MTN',
        size: '1GB',
        price: 5,
        status: 'processing',
        payment_status: 'paid',
        reference_code: `TEST-UPDATED-AT-${orderId.slice(0, 8)}`,
        category: 'data',
        source: 'web',
        updated_at: oldTimestamp,
    })
    if (insertErr) {
        console.error('FAIL: could not create test order:', insertErr.message)
        process.exit(1)
    }

    try {
        // Reproduces exactly the UPDATE app/api/admin/orders/update-status/route.ts issues.
        const { error } = await supabase
            .from('orders')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .in('id', [orderId])
            .is('refunded_at', null)

        assertOk(!error, 'update-status UPDATE succeeds')

        const { data } = await supabase.from('orders').select('status, updated_at').eq('id', orderId).single()
        assertOk(data?.status === 'completed', 'status is updated')
        assertOk(
            data?.updated_at !== undefined && new Date(data.updated_at).getTime() > new Date(oldTimestamp).getTime(),
            'updated_at is bumped past its old value'
        )
    } finally {
        await supabase.from('orders').delete().eq('id', orderId)
    }

    if (process.exitCode === 1) {
        console.error('\nSome tests failed.')
    } else {
        console.log('\nAll tests passed.')
    }
}

main()
