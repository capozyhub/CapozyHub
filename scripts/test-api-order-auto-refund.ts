// scripts/test-api-order-auto-refund.ts
//
// Live-DB coverage of autoRefundApiOrderOnFailure (lib/api-order-failure.ts,
// Task 2 of the 2026-09-08 api-auto-refund-on-failure plan) across BOTH
// airtime_orders and utility_orders:
//   1. API-sourced, eligible order -> refunded:true, order flips to
//      status='refunded' with the passed reasonMessage persisted as
//      refund_reason, and the wallet is credited by exactly the order's
//      paid amount.
//   2. A second call on the now-refunded order -> refunded:false (the
//      underlying RPC's own already_refunded no-op) and NO double credit.
//   3. A non-'api'-sourced order in the identical failed state -> the
//      helper short-circuits on params.source before ever calling the RPC,
//      so refunded:false and the order's status is untouched.
//
// Requires real Supabase credentials in env (SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_URL) -- same client-creation pattern as
// scripts/test-retry-concurrency.ts and
// scripts/test-airtime-commission-eligibility.ts. This script creates and
// cleans up its own throwaway auth users, public.users rows (via the
// on_auth_user_created trigger), wallets rows, wallet_transactions rows, and
// airtime_orders/utility_orders rows rather than touching real data.
//
// airtime_orders has NO payment_status column at all (refund_airtime_wallet
// gates only on status/user_id/shop_id); utility_orders DOES have
// payment_status and refund_utility_wallet additionally requires
// payment_status='paid' and payment_method IN ('wallet','ussd_wallet','ussd_momo').
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { autoRefundApiOrderOnFailure, REASON_MESSAGES } from '@/lib/api-order-failure'

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

const STARTING_BALANCE = 50
const AIRTIME_AMOUNT = 10
const UTILITY_AMOUNT = 15
const REASON_MESSAGE = REASON_MESSAGES.provider_rejected

async function createFixtureUser(tag: string): Promise<string> {
    const email = `test-api-autorefund-${tag}-${randomUUID().slice(0, 8)}@example.com`
    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: randomUUID(),
        email_confirm: true,
    })
    if (error || !data.user) {
        throw new Error(`could not create fixture auth user (${tag}): ${error?.message}`)
    }
    return data.user.id
}

async function createFixtureWallet(userId: string, balance: number): Promise<void> {
    // A DB trigger on auth.users already auto-creates a wallets row (balance
    // 0) for every new user -- upsert onto it rather than assuming INSERT.
    const { error } = await supabase.from('wallets').upsert({ user_id: userId, balance }, { onConflict: 'user_id' })
    if (error) {
        throw new Error(`could not create fixture wallet: ${error.message}`)
    }
}

async function getWalletBalance(userId: string): Promise<number | null> {
    const { data } = await supabase.from('wallets').select('balance').eq('user_id', userId).maybeSingle()
    return data ? Number(data.balance) : null
}

async function createFixtureAirtimeOrder(userId: string, status: string, source: string, tag: string): Promise<string> {
    const orderId = randomUUID()
    const { error } = await supabase.from('airtime_orders').insert({
        id: orderId,
        user_id: userId,
        beneficiary_phone: '0551234567',
        network: 'MTN',
        airtime_amount: AIRTIME_AMOUNT,
        total_paid: AIRTIME_AMOUNT,
        status,
        source,
        shop_id: null,
        reference_code: `TEST-AUTOREFUND-AIR-${tag}-${orderId.slice(0, 8)}`,
    })
    if (error) {
        throw new Error(`could not create fixture airtime_orders row (${tag}): ${error.message}`)
    }
    return orderId
}

async function createFixtureUtilityOrder(userId: string, status: string, source: string, tag: string): Promise<string> {
    const orderId = randomUUID()
    const { error } = await supabase.from('utility_orders').insert({
        id: orderId,
        user_id: userId,
        biller: 'ecg',
        account_number: '1234567890',
        amount: UTILITY_AMOUNT,
        payment_method: 'wallet',
        payment_status: 'paid',
        status,
        source,
        shop_id: null,
        reference_code: `TEST-AUTOREFUND-UTIL-${tag}-${orderId.slice(0, 8)}`,
    })
    if (error) {
        throw new Error(`could not create fixture utility_orders row (${tag}): ${error.message}`)
    }
    return orderId
}

type ProductConfig = {
    product: 'airtime' | 'utilities'
    table: 'airtime_orders' | 'utility_orders'
    amount: number
    createOrder: (userId: string, status: string, source: string, tag: string) => Promise<string>
}

async function runProductCases(cfg: ProductConfig, userIds: string[], orderIds: string[], nonApiSource: string = 'web') {
    const { product, table, amount, createOrder } = cfg

    // --- Case 1: API-sourced, eligible order ---
    const userA = await createFixtureUser(`${product}-a`)
    userIds.push(userA)
    await createFixtureWallet(userA, STARTING_BALANCE)
    const orderId = await createOrder(userA, 'failed', 'api', `${product}-case1`)
    orderIds.push(orderId)

    const result1 = await autoRefundApiOrderOnFailure(supabase, {
        product,
        orderId,
        source: 'api',
        reasonCode: 'provider_rejected',
        reasonMessage: REASON_MESSAGE,
    })
    assertOk(result1.refunded === true, `${product} case 1 (eligible): refunded:true`)
    assertOk(result1.amount === amount, `${product} case 1 (eligible): amount matches order's paid amount (${amount}, got ${result1.amount})`)
    assertOk(
        result1.newBalance === STARTING_BALANCE + amount,
        `${product} case 1 (eligible): newBalance is ${STARTING_BALANCE + amount} (got ${result1.newBalance})`
    )

    const { data: orderAfter1 } = await supabase.from(table).select('status, refund_reason').eq('id', orderId).single()
    assertOk(orderAfter1?.status === 'refunded', `${product} case 1 (eligible): order status is 'refunded' (got ${orderAfter1?.status})`)
    assertOk(
        orderAfter1?.refund_reason === REASON_MESSAGE,
        `${product} case 1 (eligible): refund_reason matches the passed reasonMessage (got ${orderAfter1?.refund_reason})`
    )

    // --- Case 2: idempotency -- second call on the now-refunded order ---
    const balanceAfter1 = await getWalletBalance(userA)
    const result2 = await autoRefundApiOrderOnFailure(supabase, {
        product,
        orderId,
        source: 'api',
        reasonCode: 'provider_rejected',
        reasonMessage: REASON_MESSAGE,
    })
    assertOk(result2.refunded === false, `${product} case 2 (idempotency): second call returns refunded:false`)
    const balanceAfter2 = await getWalletBalance(userA)
    assertOk(
        balanceAfter2 === balanceAfter1,
        `${product} case 2 (idempotency): wallet balance unchanged (${balanceAfter1}, got ${balanceAfter2})`
    )

    // --- Case 3: non-'api' source -- helper never even attempts the RPC ---
    const userB = await createFixtureUser(`${product}-b`)
    userIds.push(userB)
    await createFixtureWallet(userB, STARTING_BALANCE)
    const webOrderId = await createOrder(userB, 'failed', nonApiSource, `${product}-case3`)
    orderIds.push(webOrderId)

    const result3 = await autoRefundApiOrderOnFailure(supabase, {
        product,
        orderId: webOrderId,
        source: nonApiSource,
        reasonCode: 'provider_rejected',
        reasonMessage: REASON_MESSAGE,
    })
    assertOk(result3.refunded === false, `${product} case 3 (non-api source): refunded:false`)

    const { data: webOrderAfter } = await supabase.from(table).select('status').eq('id', webOrderId).single()
    assertOk(
        webOrderAfter?.status === 'failed',
        `${product} case 3 (non-api source): order status UNCHANGED, still 'failed' (got ${webOrderAfter?.status})`
    )
}

async function main() {
    const userIds: string[] = []
    const orderIds: string[] = []

    try {
        await runProductCases(
            { product: 'airtime', table: 'airtime_orders', amount: AIRTIME_AMOUNT, createOrder: createFixtureAirtimeOrder },
            userIds,
            orderIds
        )
        await runProductCases(
            { product: 'utilities', table: 'utility_orders', amount: UTILITY_AMOUNT, createOrder: createFixtureUtilityOrder },
            userIds,
            orderIds,
            'dashboard'
        )
    } finally {
        if (userIds.length) {
            await supabase.from('wallet_transactions').delete().in('user_id', userIds)
        }
        if (orderIds.length) {
            await supabase.from('airtime_orders').delete().in('id', orderIds)
            await supabase.from('utility_orders').delete().in('id', orderIds)
        }
        if (userIds.length) {
            await supabase.from('wallets').delete().in('user_id', userIds)
            for (const userId of userIds) {
                await supabase.auth.admin.deleteUser(userId)
            }
        }
    }

    if (process.exitCode === 1) {
        console.error('\nSome tests failed.')
    } else {
        console.log('\nAll api-order-auto-refund tests passed.')
    }
}

main()
