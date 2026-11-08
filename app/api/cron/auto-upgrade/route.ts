/**
 * Auto-Upgrade Cron Job
 *
 * Runs on a schedule (recommended: every 6 hours, aligned with the dealer-downgrade cron).
 * Finds all users with auto_upgrade_enabled = true whose membership is expiring soon
 * (within 24 hours) or already expired, then:
 *  - Attempts wallet deduction + role upgrade via processWalletUpgrade
 *  - On success: upgrade is applied, user notified via SMS/email/push
 *  - On insufficient balance: alerts the user and disables the auto-upgrade flag so they
 *    are not alerted every run; they re-enable it after topping up
 *  - On a permanent mismatch (plan no longer valid for their account): disables the flag and
 *    tells the user, instead of failing silently every run
 *
 * Safety:
 *  - Requires CRON_SECRET Bearer token (validateCronAuth)
 *  - The JS filter below is only a cheap pre-filter. The authoritative checks — flag still
 *    on, plan unchanged, membership actually due, account active — run again inside the
 *    database transaction under a row lock (process_wallet_upgrade), so overlapping runs or
 *    a user turning the flag off mid-run can never cause a charge.
 *  - Bounded by a time budget so a large backlog cannot hit the platform function timeout
 *    mid-user; leftovers are picked up on the next run.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateCronAuth } from '@/lib/cron-utils'
import { processWalletUpgrade, fetchUpgradePrice, isValidPlan, DEALER_PLANS } from '@/lib/wallet-upgrade'
import { sendAutoUpgradeFailedSMS } from '@/lib/sms-service'
import type { UpgradeType, PlanType } from '@/lib/wallet-upgrade'

export const dynamic = 'force-dynamic'

// Platform cap for app/api/** is 60s (vercel.json); stop starting new users well before it.
const TIME_BUDGET_MS = 45_000

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

/** Failure codes meaning "this plan can never work for this account" — stop retrying. */
const PERMANENT_FAILURE_CODES = new Set(['NOT_ELIGIBLE', 'ALREADY_LIFETIME', 'INVALID_PLAN'])
/** Failure codes meaning "nothing to do right now" — not an error. */
const SKIP_CODES = new Set(['NOT_DUE', 'AUTO_DISABLED', 'ACCOUNT_INACTIVE'])

export async function GET(request: Request) {
    const authError = validateCronAuth(request)
    if (authError) return authError

    const startedAt = Date.now()

    try {
        const now = new Date()
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

        // Fetch all users who have auto-upgrade enabled
        // We target users whose role is expiring within 24 hours OR already expired
        // (null agent_expires_at = permanent = doesn't need renewal)
        const { data: candidates, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, first_name, phone_number, email, role, agent_expires_at, dealer_expires_at, auto_upgrade_plan')
            .eq('auto_upgrade_enabled', true)
            .eq('status', 'active')
            .in('role', ['agent', 'dealer', 'customer'])

        if (fetchError) {
            console.error('[AutoUpgrade] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({ message: 'No users with auto-upgrade enabled', processed: 0 })
        }

        // Cheap pre-filter (the DB function re-checks all of this under lock):
        // - Dealer: dealer_expires_at within 24h or past
        // - Agent (timed): agent_expires_at within 24h or past
        // - Lifetime agent: only if they chose a dealer plan (lifetime agent -> dealer)
        // - Customer: eligible for any plan (first-time upgrade or renewal after the expiry downgrade)
        const due = candidates.filter((u: any) => {
            if (u.role === 'dealer') {
                if (!u.dealer_expires_at) return false
                return new Date(u.dealer_expires_at) <= in24h
            }
            if (u.role === 'agent') {
                if (!u.agent_expires_at) {
                    return (DEALER_PLANS as readonly string[]).includes(u.auto_upgrade_plan)
                }
                return new Date(u.agent_expires_at) <= in24h
            }
            return true
        })

        if (due.length === 0) {
            return NextResponse.json({ message: 'No users due for auto-upgrade', processed: 0 })
        }

        console.log(`[AutoUpgrade] ${due.length} users due for auto-upgrade`)

        const results: Array<{ id: string; status: string; error?: string }> = []
        let deferred = 0

        for (const user of due) {
            if (Date.now() - startedAt > TIME_BUDGET_MS) {
                deferred = due.length - results.length
                console.warn(`[AutoUpgrade] Time budget reached, deferring ${deferred} user(s) to the next run`)
                break
            }

            const plan = user.auto_upgrade_plan as PlanType | null
            if (!plan) {
                results.push({ id: user.id, status: 'skipped', error: 'No plan configured' })
                continue
            }

            const upgradeType: UpgradeType = (DEALER_PLANS as readonly string[]).includes(plan) ? 'dealer' : 'agent'
            if (!isValidPlan(upgradeType, plan)) {
                results.push({ id: user.id, status: 'skipped', error: 'Invalid plan' })
                continue
            }

            // Fetch authoritative price from admin_settings
            let price: number
            let planLabel: string
            try {
                ;({ price, planLabel } = await fetchUpgradePrice(upgradeType, plan, supabaseAdmin))
            } catch (err: any) {
                // Pricing misconfigured — never guess a price. Leave the user untouched; retry next run.
                results.push({ id: user.id, status: 'failed', error: err?.message ?? 'Pricing unavailable' })
                continue
            }

            const result = await processWalletUpgrade({
                userId: user.id,
                upgradeType,
                plan,
                price,
                planLabel,
                isAutoUpgrade: true,
                dueBefore: in24h,
            })

            if (result.success) {
                results.push({ id: user.id, status: result.alreadyProcessed ? 'already_upgraded' : 'upgraded' })
                console.log(`[AutoUpgrade] User ${user.id} auto-upgraded (${planLabel})`)
            } else if (result.insufficientBalance) {
                console.log(`[AutoUpgrade] User ${user.id} insufficient balance — need GHS ${result.requiredAmount}, have GHS ${result.currentBalance}`)

                // Disable auto-upgrade to prevent repeated failure alerts each cron run.
                // User must manually re-enable after topping up.
                await (supabaseAdmin.from('users') as any)
                    .update({ auto_upgrade_enabled: false, updated_at: now.toISOString() })
                    .eq('id', user.id)

                // In-app notification
                await (supabaseAdmin.from('notifications') as any).insert({
                    user_id: user.id,
                    title: 'Auto-Upgrade Failed — Top Up Required',
                    message: `Your auto-upgrade for ${planLabel} failed. Wallet balance: GHS ${(result.currentBalance ?? 0).toFixed(2)}, needed: GHS ${(result.requiredAmount ?? 0).toFixed(2)}. Auto-upgrade has been disabled. Top up your wallet and re-enable it to continue.`,
                    type: 'system',
                    action_url: '/dashboard/wallet',
                })

                // SMS alert
                if (user.phone_number) {
                    await sendAutoUpgradeFailedSMS(
                        user.phone_number,
                        user.first_name || 'User',
                        planLabel,
                        result.currentBalance ?? 0,
                        result.requiredAmount ?? price
                    ).catch(err => console.error(`[AutoUpgrade] SMS error for ${user.id}:`, err))
                }

                // Email alert
                if (user.email) {
                    const { sendAutoUpgradeFailedEmail } = await import('@/lib/email-service').catch(() => ({ sendAutoUpgradeFailedEmail: null }))
                    if (sendAutoUpgradeFailedEmail) {
                        await sendAutoUpgradeFailedEmail(
                            user.email,
                            user.first_name || 'User',
                            planLabel,
                            result.currentBalance ?? 0,
                            result.requiredAmount ?? price
                        ).catch(() => null)
                    }
                }

                results.push({ id: user.id, status: 'insufficient_balance', error: result.error })
            } else if (result.code && SKIP_CODES.has(result.code)) {
                results.push({ id: user.id, status: 'skipped', error: result.code })
            } else if (result.code && PERMANENT_FAILURE_CODES.has(result.code)) {
                // The saved plan can never be bought by this account (e.g. a timed agent holding a
                // dealer plan). Without this the user believed they were covered while it failed
                // silently every run until their membership lapsed.
                console.warn(`[AutoUpgrade] User ${user.id} plan ${plan} not purchasable (${result.code}) — disabling auto-upgrade`)
                await (supabaseAdmin.from('users') as any)
                    .update({ auto_upgrade_enabled: false, auto_upgrade_plan: null, updated_at: now.toISOString() })
                    .eq('id', user.id)
                    .eq('auto_upgrade_plan', plan)
                await (supabaseAdmin.from('notifications') as any).insert({
                    user_id: user.id,
                    title: 'Auto-Upgrade Turned Off',
                    message: `Your auto-upgrade for ${planLabel} can't be used on your current membership, so it has been turned off. Open the Upgrade page to choose a plan that fits.`,
                    type: 'system',
                    action_url: '/dashboard/upgrade',
                })
                results.push({ id: user.id, status: 'disabled', error: result.code })
            } else {
                results.push({ id: user.id, status: 'failed', error: result.error })
                console.error(`[AutoUpgrade] Failed for user ${user.id}:`, result.error)
            }
        }

        const upgraded = results.filter(r => r.status === 'upgraded').length
        const failed = results.filter(r => r.status === 'insufficient_balance' || r.status === 'failed').length

        return NextResponse.json({
            message: 'Auto-upgrade cron completed',
            total: due.length,
            upgraded,
            failed,
            deferred,
            results,
        })
    } catch (err: any) {
        console.error('[AutoUpgrade] Exception:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
