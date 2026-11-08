/**
 * Wallet-based role upgrade processor.
 * Used by the wallet upgrade API route and the auto-upgrade cron job.
 *
 * The money + role change is ONE database transaction (`process_wallet_upgrade`, see
 * supabase/migrations/20261012_atomic_wallet_upgrade.sql). This file validates input,
 * calls it, maps its result codes, and sends notifications afterwards.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'

export type UpgradeType = 'agent' | 'dealer'
export type AgentPlan = '3d' | '14d' | '30d' | 'permanent'
export type DealerPlan = '1m' | '3m' | '6m'
export type PlanType = AgentPlan | DealerPlan

export const AGENT_PLANS: readonly AgentPlan[] = ['3d', '14d', '30d', 'permanent']
export const DEALER_PLANS: readonly DealerPlan[] = ['1m', '3m', '6m']

/** Client sent something that is not a purchasable plan / upgrade type. Maps to HTTP 400. */
export class UpgradeInputError extends Error {}
/** An admin_settings price is present but unusable. Maps to HTTP 503 — never charge a guess. */
export class UpgradePricingError extends Error {}

export function isValidPlan(upgradeType: UpgradeType, plan: unknown): plan is PlanType {
    if (typeof plan !== 'string') return false
    return upgradeType === 'dealer'
        ? (DEALER_PLANS as readonly string[]).includes(plan)
        : (AGENT_PLANS as readonly string[]).includes(plan)
}

interface UpgradeParams {
    userId: string
    upgradeType: UpgradeType
    plan: PlanType
    /** Server-resolved price (fetchUpgradePrice) — never a client value. */
    price: number
    planLabel: string
    /** Triggered by the auto-upgrade cron (affects notifications and re-checks renewal state). */
    isAutoUpgrade?: boolean
    /** Retrying the same key never charges twice. Required for user-initiated purchases. */
    idempotencyKey?: string
    /** Auto-upgrade only: re-checked under the DB lock so overlapping cron runs can't double-renew. */
    dueBefore?: Date
}

export interface UpgradeResult {
    success: boolean
    error?: string
    /** Machine-readable failure reason from the DB function. */
    code?: string
    insufficientBalance?: boolean
    currentBalance?: number
    requiredAmount?: number
    newExpiry?: string | null
    newBalance?: number
    /** True when this was a replay of an already-completed request (nothing was charged). */
    alreadyProcessed?: boolean
}

function buildAdminClient(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

export function planDaysFromType(plan: AgentPlan): number | null {
    if (plan === 'permanent') return null
    if (plan === '3d') return 3
    if (plan === '14d') return 14
    return 30
}

export function dealerMonthsFromPlan(plan: DealerPlan): number {
    if (plan === '1m') return 1
    if (plan === '3m') return 3
    return 6
}

/**
 * Process a wallet-funded role upgrade for a user.
 *
 * Guarantees (all enforced inside the database transaction):
 * - The user row is locked, so concurrent requests are serialised, not raced.
 * - Debit, ledger row, role grant, shop repricing and audit row commit together or not at all.
 * - A repeated idempotency key replays the stored result instead of charging again.
 * - Eligibility (including "lifetime agents cannot buy a timed pass") is checked under the lock.
 */
export async function processWalletUpgrade(params: UpgradeParams): Promise<UpgradeResult> {
    const { userId, upgradeType, plan, price, planLabel, isAutoUpgrade = false, idempotencyKey, dueBefore } = params

    if (!isValidPlan(upgradeType, plan)) {
        return { success: false, code: 'INVALID_PLAN', error: 'Invalid plan' }
    }
    if (!Number.isFinite(price) || price <= 0) {
        return { success: false, code: 'INVALID_PRICE', error: 'Upgrade price is not valid' }
    }

    const supabase = buildAdminClient()

    const { data, error } = await supabase.rpc('process_wallet_upgrade', {
        p_user_id: userId,
        p_upgrade_type: upgradeType,
        p_plan: plan,
        p_price: price,
        p_plan_label: planLabel,
        p_idempotency_key: idempotencyKey ?? null,
        p_is_auto: isAutoUpgrade,
        p_due_before: dueBefore ? dueBefore.toISOString() : null,
    })

    if (error || !data) {
        // The transaction rolled back, so nothing was charged.
        console.error('[WalletUpgrade] RPC error:', error)
        return { success: false, code: 'INTERNAL', error: 'Upgrade could not be completed. You have not been charged.' }
    }

    const res = data as {
        ok: boolean
        code?: string
        message?: string
        balance?: number
        required?: number
        already_processed?: boolean
        previous_role?: string
        new_expiry?: string | null
        was_extension?: boolean
        new_balance?: number
    }

    if (!res.ok) {
        if (res.code === 'INSUFFICIENT_BALANCE') {
            return {
                success: false,
                code: res.code,
                insufficientBalance: true,
                currentBalance: Number(res.balance ?? 0),
                requiredAmount: Number(res.required ?? price),
                error: 'Insufficient wallet balance',
            }
        }
        return { success: false, code: res.code, error: res.message ?? 'Upgrade failed' }
    }

    const newExpiry = res.new_expiry ? new Date(res.new_expiry) : null
    const newBalance = Number(res.new_balance ?? 0)

    if (!res.already_processed) {
        // waitUntil keeps the serverless function alive until the notifications finish; a bare
        // un-awaited promise is frozen as soon as the response is sent.
        waitUntil(
            sendUpgradeNotifications({
                userId, upgradeType, plan, planLabel, price, isAutoUpgrade,
                newExpiry, newBalance, isExtension: !!res.was_extension,
            }).catch(err => console.error('[WalletUpgrade] Notification error:', err))
        )
    }

    return {
        success: true,
        newExpiry: newExpiry ? newExpiry.toISOString() : null,
        newBalance,
        alreadyProcessed: !!res.already_processed,
    }
}

interface NotificationParams {
    userId: string
    upgradeType: UpgradeType
    plan: PlanType
    planLabel: string
    price: number
    isAutoUpgrade: boolean
    newExpiry: Date | null
    newBalance: number
    isExtension: boolean
}

async function sendUpgradeNotifications(p: NotificationParams): Promise<void> {
    const { userId, upgradeType, plan, planLabel, price, isAutoUpgrade, newExpiry, newBalance, isExtension } = p
    const supabase = buildAdminClient()

    const { data: userRow } = await supabase
        .from('users')
        .select('email, first_name, phone_number')
        .eq('id', userId)
        .single()
    const user = (userRow ?? {}) as { email?: string | null; first_name?: string | null; phone_number?: string | null }

    const expiryFormatted = newExpiry
        ? newExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : null
    const isPermanent = plan === 'permanent'
    const tierName = upgradeType === 'dealer' ? 'Dealer' : 'Agent'

    const notifTitle = isPermanent
        ? 'Permanent Agent Unlocked!'
        : isAutoUpgrade
            ? 'Auto-Upgrade Successful'
            : isExtension
                ? `${tierName} Membership Extended!`
                : `${tierName} Status Activated!`

    const notifMessage = isPermanent
        ? 'You now have lifetime access to all Agent benefits. Congratulations!'
        : isAutoUpgrade
            ? `Your ${planLabel} was auto-renewed from your wallet. ${expiryFormatted ? `Active until ${expiryFormatted}.` : ''} Balance: GHS ${newBalance.toFixed(2)}.`
            : `Your ${planLabel} is now active${expiryFormatted ? ` until ${expiryFormatted}` : ''}. GHS ${price.toFixed(2)} deducted from wallet.`

    const { error: notifError } = await (supabase.from('notifications') as any).insert({
        user_id: userId,
        title: notifTitle,
        message: notifMessage,
        type: 'system',
        action_url: '/dashboard',
    })
    if (notifError) console.error('[WalletUpgrade] In-app notification insert failed:', notifError)

    const { sendPushNotification } = await import('@/lib/push-service')
    await sendPushNotification(userId, { title: notifTitle, body: notifMessage, url: '/dashboard' }).catch(() => null)

    const {
        sendAgentUpgradeSuccessSMS,
        sendAgentExtensionSuccessSMS,
        sendPermanentAgentUpgradeSuccessSMS,
        sendDealerActivationSuccessSMS,
        sendDealerExtensionSuccessSMS,
        sendAutoUpgradeSuccessSMS,
    } = await import('@/lib/sms-service')

    const {
        sendPermanentAgentUpgradeSuccessEmail,
        sendDealerActivationSuccessEmail,
        sendDealerExtensionSuccessEmail,
    } = await import('@/lib/email-service')

    if (user.phone_number) {
        if (isAutoUpgrade && newExpiry) {
            await sendAutoUpgradeSuccessSMS(user.phone_number, user.first_name || 'User', planLabel, newExpiry, newBalance).catch(() => null)
        } else if (upgradeType === 'dealer' && newExpiry) {
            if (isExtension) {
                await sendDealerExtensionSuccessSMS(user.phone_number, newExpiry).catch(() => null)
            } else {
                await sendDealerActivationSuccessSMS(user.phone_number, user.first_name || 'Dealer', newExpiry).catch(() => null)
            }
        } else if (isPermanent) {
            await sendPermanentAgentUpgradeSuccessSMS(user.phone_number).catch(() => null)
        } else if (newExpiry) {
            if (isExtension) {
                await sendAgentExtensionSuccessSMS(user.phone_number, newExpiry).catch(() => null)
            } else {
                const remainingDays = Math.ceil((newExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                await sendAgentUpgradeSuccessSMS(user.phone_number, user.first_name || 'Agent', planLabel, remainingDays, newExpiry.toISOString()).catch(() => null)
            }
        }
    }

    if (user.email) {
        if (isPermanent) {
            await sendPermanentAgentUpgradeSuccessEmail(user.email, user.first_name || 'User').catch(() => null)
        } else if (upgradeType === 'dealer' && newExpiry) {
            if (isExtension) {
                await sendDealerExtensionSuccessEmail(user.email, user.first_name || 'Dealer', newExpiry).catch(() => null)
            } else {
                await sendDealerActivationSuccessEmail(user.email, user.first_name || 'Dealer', newExpiry).catch(() => null)
            }
        }
    }
}

const PRICE_KEYS = [
    'agent_upgrade_price_3d',
    'agent_upgrade_price_14d',
    'agent_upgrade_price_30d',
    'agent_upgrade_price_permanent',
    'dealer_upgrade_price_1m',
    'dealer_upgrade_price_3m',
    'dealer_upgrade_price_6m',
]

const PLAN_CONFIG: Record<PlanType, { key: string; def: number; label: string; days: number | null }> = {
    '3d':        { key: 'agent_upgrade_price_3d',        def: 9.99,   label: '3 Days Agent Pass',    days: 3 },
    '14d':       { key: 'agent_upgrade_price_14d',       def: 49.99,  label: '14 Days Agent Pass',   days: 14 },
    '30d':       { key: 'agent_upgrade_price_30d',       def: 99.99,  label: '30 Days Agent Pass',   days: 30 },
    'permanent': { key: 'agent_upgrade_price_permanent', def: 149.99, label: 'Permanent Agent Pass', days: null },
    '1m':        { key: 'dealer_upgrade_price_1m',       def: 99.99,  label: '1 Month Dealer Pass',  days: 30 },
    '3m':        { key: 'dealer_upgrade_price_3m',       def: 199.99, label: '3 Months Dealer Pass', days: 90 },
    '6m':        { key: 'dealer_upgrade_price_6m',       def: 299.99, label: '6 Months Dealer Pass', days: 180 },
}

/**
 * Pure price resolution from admin_settings rows. Throws instead of falling back:
 * an unknown plan is the caller's mistake (UpgradeInputError), and a stored price that
 * is not a positive finite number is a configuration fault (UpgradePricingError) —
 * neither may silently turn into a different charge.
 */
export function resolveUpgradePrice(
    upgradeType: UpgradeType,
    plan: unknown,
    settings: ReadonlyArray<{ key: string; value: unknown }> | null | undefined
): { price: number; planLabel: string; planDays: number | null } {
    if (!isValidPlan(upgradeType, plan)) {
        throw new UpgradeInputError('Invalid plan')
    }
    const entry = PLAN_CONFIG[plan]
    const row = settings?.find(s => s.key === entry.key)
    const price = row ? Number(row.value) : entry.def
    if (!Number.isFinite(price) || price <= 0) {
        console.error(`[WalletUpgrade] Invalid admin price for ${entry.key}:`, row?.value)
        throw new UpgradePricingError('Upgrade pricing is temporarily unavailable')
    }
    return { price, planLabel: entry.label, planDays: entry.days }
}

/** Fetch the authoritative upgrade price from admin_settings. */
export async function fetchUpgradePrice(
    upgradeType: UpgradeType,
    plan: unknown,
    supabase: SupabaseClient
): Promise<{ price: number; planLabel: string; planDays: number | null }> {
    if (!isValidPlan(upgradeType, plan)) {
        throw new UpgradeInputError('Invalid plan')
    }
    const { data: settings, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', PRICE_KEYS)
    if (error) {
        console.error('[WalletUpgrade] Failed to load upgrade prices:', error)
        throw new UpgradePricingError('Upgrade pricing is temporarily unavailable')
    }
    return resolveUpgradePrice(upgradeType, plan, settings)
}
