// scripts/test-airtime-commission-eligibility.ts
// Live-DB verification of credit_airtime_commission's lifetime-eligibility gate
// (Task 1): dealer passes unconditionally, agent requires agent_expires_at IS
// NULL (lifetime), everyone else no-ops (platform keeps 100%); the claim
// itself requires status='completed', commission_amount IS NOT NULL,
// commission_credited_at IS NULL, AND source='api'.
//
// Requires real Supabase credentials in env (SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_URL) — same client-creation pattern as
// scripts/test-retry-concurrency.ts. This script creates and cleans up its
// own throwaway auth users, public.users rows, airtime_orders rows,
// commission_wallets rows, and commission_wallet_transactions rows rather
// than touching real data.
//
// public.users.id has a FOREIGN KEY to auth.users(id), and an
// `on_auth_user_created` trigger auto-inserts a public.users row (role
// defaulted to 'customer') whenever an auth user is created — so each fixture
// user is created via supabase.auth.admin.createUser() and then UPDATEd to
// set role/dealer_expires_at/agent_expires_at.
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

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 days
const COMMISSION_AMOUNT = 1.0

type FixtureRole = 'dealer' | 'agent' | 'customer'

async function createFixtureUser(role: FixtureRole, expiresAt: string | null, tag: string): Promise<string> {
    const email = `test-airtime-commission-${tag}-${randomUUID().slice(0, 8)}@example.com`
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: randomUUID(),
        email_confirm: true,
    })
    if (error || !data.user) {
        throw new Error(`could not create fixture auth user (${tag}): ${error?.message}`)
    }
    const userId = data.user.id

    const patch: Record<string, unknown> = { role }
    if (role === 'dealer') patch.dealer_expires_at = expiresAt
    if (role === 'agent') patch.agent_expires_at = expiresAt

    const { error: updateErr } = await supabase.from('users').update(patch).eq('id', userId)
    if (updateErr) {
        throw new Error(`could not set up fixture user role (${tag}): ${updateErr.message}`)
    }
    return userId
}

async function createFixtureOrder(userId: string, source: 'api' | 'shop', tag: string): Promise<string> {
    const orderId = randomUUID()
    const { error } = await supabase.from('airtime_orders').insert({
        id: orderId,
        user_id: userId,
        network: 'MTN',
        beneficiary_phone: '0551234567',
        airtime_amount: 10,
        fee_rate: 0,
        fee_amount: 0,
        total_paid: 10,
        status: 'completed',
        reference_code: `TEST-AIRCOMM-${tag}-${orderId.slice(0, 8)}`,
        type: 'airtime',
        source,
        commission_amount: COMMISSION_AMOUNT,
        commission_credited_at: null,
    })
    if (error) {
        throw new Error(`could not create fixture airtime_orders row (${tag}): ${error.message}`)
    }
    return orderId
}

async function getWalletBalance(ownerId: string): Promise<number | null> {
    const { data } = await supabase.from('commission_wallets').select('balance').eq('owner_id', ownerId).maybeSingle()
    return data ? Number(data.balance) : null
}

async function main() {
    const userIds: string[] = []
    const orderIds: string[] = []

    try {
        // Read the live partner-share setting, matching credit_airtime_commission's
        // own COALESCE(..., 40) default and 0-100 clamp.
        const { data: settingRow } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'utility_commission_partner_percent')
            .maybeSingle()
        const rawPct = settingRow ? Number(String(settingRow.value).replace(/^"|"$/g, '')) : NaN
        const pct = Math.min(Math.max(Number.isFinite(rawPct) ? rawPct : 40, 0), 100)
        const expectedShare = Math.round(((COMMISSION_AMOUNT * pct) / 100) * 10000) / 10000
        console.log(`Using utility_commission_partner_percent=${pct} -> expected share ${expectedShare}`)

        // --- Case 1: Dealer buyer (unconditional pass) ---
        {
            const userId = await createFixtureUser('dealer', FUTURE, 'dealer')
            userIds.push(userId)
            const orderId = await createFixtureOrder(userId, 'api', 'case1')
            orderIds.push(orderId)

            const { data, error } = await supabase.rpc('credit_airtime_commission', { p_airtime_order_id: orderId })
            assertOk(!error && data?.success === true, 'case 1 (dealer): RPC returns success:true')
            assertOk(typeof data?.amount === 'number' && data.amount > 0, 'case 1 (dealer): response has amount > 0')

            const balance = await getWalletBalance(userId)
            assertOk(balance === expectedShare, `case 1 (dealer): wallet balance is ${expectedShare} (got ${balance})`)
        }

        // --- Case 2: Lifetime agent buyer (agent_expires_at IS NULL) ---
        {
            const userId = await createFixtureUser('agent', null, 'lifetime-agent')
            userIds.push(userId)
            const orderId = await createFixtureOrder(userId, 'api', 'case2')
            orderIds.push(orderId)

            const { data, error } = await supabase.rpc('credit_airtime_commission', { p_airtime_order_id: orderId })
            assertOk(!error && data?.success === true, 'case 2 (lifetime agent): RPC returns success:true')
            assertOk(typeof data?.amount === 'number' && data.amount > 0, 'case 2 (lifetime agent): response has amount > 0')

            const balance = await getWalletBalance(userId)
            assertOk(balance === expectedShare, `case 2 (lifetime agent): wallet balance is ${expectedShare} (got ${balance})`)
        }

        // --- Case 3: Expiring (non-lifetime) agent buyer ---
        {
            const userId = await createFixtureUser('agent', FUTURE, 'expiring-agent')
            userIds.push(userId)
            const orderId = await createFixtureOrder(userId, 'api', 'case3')
            orderIds.push(orderId)

            const { data, error } = await supabase.rpc('credit_airtime_commission', { p_airtime_order_id: orderId })
            assertOk(!error && data?.success === true, 'case 3 (expiring agent): RPC returns success:true')
            assertOk(
                typeof data?.message === 'string' && data.message.includes('not a lifetime agent/dealer'),
                `case 3 (expiring agent): message mentions 'not a lifetime agent/dealer' (got: ${data?.message})`
            )

            const balance = await getWalletBalance(userId)
            assertOk(balance === null, `case 3 (expiring agent): no commission_wallets row created (got ${balance})`)
        }

        // --- Case 4: Customer buyer ---
        {
            const userId = await createFixtureUser('customer', null, 'customer')
            userIds.push(userId)
            const orderId = await createFixtureOrder(userId, 'api', 'case4')
            orderIds.push(orderId)

            const { data, error } = await supabase.rpc('credit_airtime_commission', { p_airtime_order_id: orderId })
            assertOk(!error && data?.success === true, 'case 4 (customer): RPC returns success:true')
            assertOk(
                typeof data?.message === 'string' && data.message.includes('not a lifetime agent/dealer'),
                `case 4 (customer): message mentions 'not a lifetime agent/dealer' (got: ${data?.message})`
            )

            const balance = await getWalletBalance(userId)
            assertOk(balance === null, `case 4 (customer): no commission_wallets row created (got ${balance})`)
        }

        // --- Case 5: Already-credited order (second call is a no-op) ---
        {
            const userId = await createFixtureUser('dealer', FUTURE, 'double-credit')
            userIds.push(userId)
            const orderId = await createFixtureOrder(userId, 'api', 'case5')
            orderIds.push(orderId)

            const first = await supabase.rpc('credit_airtime_commission', { p_airtime_order_id: orderId })
            assertOk(!first.error && first.data?.success === true, 'case 5 (double-credit): first call succeeds')
            assertOk(
                typeof first.data?.amount === 'number' && first.data.amount > 0,
                'case 5 (double-credit): first call credits an amount > 0'
            )

            const second = await supabase.rpc('credit_airtime_commission', { p_airtime_order_id: orderId })
            assertOk(!second.error && second.data?.success === true, 'case 5 (double-credit): second call still succeeds')
            assertOk(
                second.data?.amount === undefined,
                `case 5 (double-credit): second call is a no-op (no amount field, got: ${JSON.stringify(second.data)})`
            )

            const balance = await getWalletBalance(userId)
            assertOk(
                balance === expectedShare,
                `case 5 (double-credit): wallet balance reflects exactly ONE credit (${expectedShare}, got ${balance})`
            )
        }

        // --- Case 6: Non-'api' source (source='shop' excluded by the claim) ---
        {
            const userId = await createFixtureUser('dealer', FUTURE, 'shop-source')
            userIds.push(userId)
            const orderId = await createFixtureOrder(userId, 'shop', 'case6')
            orderIds.push(orderId)

            const { data, error } = await supabase.rpc('credit_airtime_commission', { p_airtime_order_id: orderId })
            assertOk(!error && data?.success === true, 'case 6 (source=shop): RPC returns success:true')
            assertOk(
                data?.amount === undefined,
                `case 6 (source=shop): no-op — claim excludes non-api source (got: ${JSON.stringify(data)})`
            )

            const balance = await getWalletBalance(userId)
            assertOk(balance === null, `case 6 (source=shop): no commission_wallets row created (got ${balance})`)
        }
    } finally {
        if (orderIds.length) {
            await supabase.from('commission_wallet_transactions').delete().in('airtime_order_id', orderIds)
            await supabase.from('airtime_orders').delete().in('id', orderIds)
        }
        if (userIds.length) {
            await supabase.from('commission_wallets').delete().in('owner_id', userIds)
            for (const userId of userIds) {
                await supabase.auth.admin.deleteUser(userId)
            }
        }
    }

    if (process.exitCode === 1) {
        console.error('\nSome tests failed.')
    } else {
        console.log('\nAll airtime-commission-eligibility tests passed.')
    }
}

main()
