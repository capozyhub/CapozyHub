import { createServerClient } from './supabase'
import { sendWalletTopupSuccessEmail, sendPermanentAgentUpgradeSuccessEmail } from './email-service'
import { sendWalletTopupSuccessSMS, sendAgentUpgradeSuccessSMS, sendAgentExtensionSuccessSMS, sendPermanentAgentUpgradeSuccessSMS } from './sms-service'
import { waitUntil } from '@vercel/functions'

export { processCompletedDealerUpgradePayment } from './dealer-payments'

/**
 * Processes a completed payment by updating the status, 
 * crediting the wallet, logging the transaction, and notifying the user.
 * This is designed to be idempotent.
 */
export async function processCompletedWalletPayment(reference: string, providerMetadata?: any) {
    const supabase = createServerClient()

    // 1. Get payment record
    const { data: paymentData, error: paymentError } = await supabase
        .from('wallet_payments')
        .select('*')
        .eq('reference', reference)
        .single()

    const payment = paymentData as any

    if (paymentError || !payment) {
        console.error('[PaymentProcess] Payment not found:', reference)
        return { success: false, error: 'Payment not found' }
    }

    // 1a. Membership-upgrade payments share this table. They are settled by their own
    // processors (routed by metadata.upgrade_type) and must never become wallet balance.
    if (payment.status === 'pending' && payment.metadata?.upgrade_type) {
        console.error('[PaymentProcess] Refusing to treat an upgrade payment as a wallet top-up:', reference)
        return { success: false, error: 'Not a wallet top-up' }
    }

    // 1b. Amount verification (defense-in-depth).
    // The Paystack webhook cross-checks the paid amount before calling us, but
    // the synchronous verify/check-pending paths do not — so we re-check here to
    // guarantee NO path can credit a wallet for more than was actually paid.
    // Paystack always reports `amount` in the minor unit (pesewas/kobo).
    const providerAmountKobo = providerMetadata?.amount
    const expectedTotal = Number((payment as any).total_amount)
    if (
        typeof providerAmountKobo === 'number' &&
        Number.isFinite(providerAmountKobo) &&
        Number.isFinite(expectedTotal) &&
        expectedTotal > 0
    ) {
        const expectedKobo = Math.round(expectedTotal * 100)
        if (providerAmountKobo !== expectedKobo) {
            console.error(
                `[PaymentProcess] AMOUNT MISMATCH for ${reference}: expected ${expectedKobo} kobo, got ${providerAmountKobo} kobo`
            )
            // Mark failed (only if still pending) so it can never be credited later.
            await (supabase.from('wallet_payments') as any)
                .update({
                    status: 'failed',
                    metadata: {
                        ...((payment as any).metadata || {}),
                        mismatch_reason: `Amount mismatch: expected ${expectedKobo} kobo, received ${providerAmountKobo} kobo`,
                        mismatch_detected_at: new Date().toISOString(),
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id)
                .eq('status', 'pending')
            return { success: false, error: 'Amount mismatch' }
        }
    }

    // 2-4. Complete the payment, credit the wallet and log the transaction in ONE
    // database transaction (complete_wallet_topup). It flips pending → completed
    // under a row lock, so it is idempotent, and if any step fails everything rolls
    // back and the payment stays pending for the next webhook/cron/poll to retry.
    // The old flow did these as separate calls: a crash between "mark completed" and
    // "credit" left a paid, completed, uncredited payment that nothing ever retried.
    const { data: completion, error: completeError } = await (supabase as any).rpc('complete_wallet_topup', {
        p_reference: reference,
        p_provider_metadata: providerMetadata ?? null,
    })

    if (completeError || !completion) {
        console.error('[PaymentProcess] complete_wallet_topup error:', completeError)
        return { success: false, error: 'Failed to credit wallet' }
    }

    switch (completion.status) {
        case 'completed':
            break
        case 'already_processed':
            return { success: true, alreadyProcessed: true }
        case 'not_found':
            return { success: false, error: 'Payment not found' }
        case 'not_topup':
            return { success: false, error: 'Not a wallet top-up' }
        default:
            console.error('[PaymentProcess] Payment not creditable:', reference, completion)
            return { success: false, error: 'Payment is not pending' }
    }

    const newBalance: number = Number(completion.new_balance)

    // 5. Create notification
    const { error: notifyError } = await (supabase.from('notifications') as any).insert({
        user_id: payment.user_id,
        title: 'Wallet Topped Up',
        message: `Your wallet has been credited with GHS ${payment.amount.toFixed(2)}`,
        type: 'payment_success',
        action_url: '/dashboard/wallet',
    })

    if (notifyError) {
        console.error('[PaymentProcess] Notification error:', notifyError)
    }

    // 6. Send push, email and SMS notification in background
    waitUntil((async () => {
        try {
            const { sendPushNotification } = await import('@/lib/push-service')
            await sendPushNotification(payment.user_id, {
                title: 'Wallet Topped Up',
                body: `Your wallet has been credited with GHS ${payment.amount.toFixed(2)}`,
                url: '/dashboard/wallet'
            }).catch(err => console.error('[PaymentProcess] Push error:', err))

            // Get user details for email
            const { data: userData } = await supabase
                .from('users')
                .select('email, first_name, phone_number')
                .eq('id', payment.user_id)
                .single()

            if (userData) {
                // Await email first so it doesn't get blocked by SMS
                await sendWalletTopupSuccessEmail(
                    (userData as any).email,
                    (userData as any).first_name || 'Customer',
                    payment.amount,
                    reference,
                    newBalance
                ).catch(err => console.error('[PaymentProcess] Email error:', err))

                // Send SMS notification
                if ((userData as any).phone_number) {
                    console.log('[PaymentProcess] Found user phone:', (userData as any).phone_number)
                    await sendWalletTopupSuccessSMS(
                        (userData as any).phone_number,
                        {
                            amount: payment.amount,
                            newBalance
                        }
                    ).then(res => console.log('[PaymentProcess] SMS Result:', res))
                        .catch(err => console.error('[PaymentProcess] SMS error:', err))
                } else {
                    console.warn('[PaymentProcess] No phone number found for user:', payment.user_id)
                }

            }
        } catch (emailError) {
            // Don't fail the payment process if email fails
            console.error('[PaymentProcess] Notification error:', emailError)
        }
    })())

    return { success: true }
}

/**
 * Processes a completed upgrade payment by updating the user's role 
 * and extending their agent membership duration.
 */
export async function processCompletedUpgradePayment(reference: string, providerMetadata: any) {
    const supabase = createServerClient()

    // 1. Get payment record
    const { data: paymentData, error: paymentError } = await supabase
        .from('wallet_payments')
        .select('*')
        .eq('reference', reference)
        .single()

    const payment = paymentData as any

    if (paymentError || !payment) {
        console.error('[UpgradeProcess] Payment not found:', reference)
        return { success: false, error: 'Payment not found' }
    }

    // 1b. Amount verification (defense-in-depth).
    // The Paystack webhook cross-checks the paid amount before calling us, but
    // the synchronous verify/check-pending paths do not — so we re-check here to
    // guarantee NO path can apply an upgrade for less than was actually due.
    // Paystack always reports `amount` in the minor unit (pesewas/kobo).
    const providerAmountKobo = providerMetadata?.amount
    const expectedTotal = Number((payment as any).total_amount)
    if (
        typeof providerAmountKobo === 'number' &&
        Number.isFinite(providerAmountKobo) &&
        Number.isFinite(expectedTotal) &&
        expectedTotal > 0
    ) {
        const expectedKobo = Math.round(expectedTotal * 100)
        if (providerAmountKobo !== expectedKobo) {
            console.error(`[UpgradeProcess] AMOUNT MISMATCH for ${reference}: expected ${expectedKobo} kobo, got ${providerAmountKobo} kobo`)
            await (supabase.from('wallet_payments') as any)
                .update({
                    status: 'failed',
                    metadata: {
                        ...((payment as any).metadata || {}),
                        mismatch_reason: `Amount mismatch: expected ${expectedKobo} kobo, received ${providerAmountKobo} kobo`,
                        mismatch_detected_at: new Date().toISOString(),
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', (payment as any).id)
                .eq('status', 'pending')
            return { success: false, error: 'Amount mismatch' }
        }
    }

    // 2. Atomic Update (Idempotency Check)
    const { data: updatedPayment, error: updatePaymentError } = await (supabase
        .from('wallet_payments') as any)
        .update({
            status: 'completed',
            metadata: providerMetadata,
            updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .eq('status', 'pending')
        .select()
        .single()

    if (updatePaymentError) {
        if (updatePaymentError.code === 'PGRST116') {
            return { success: true, alreadyProcessed: true }
        }
        console.error('[UpgradeProcess] Update payment error:', updatePaymentError)
        return { success: false, error: 'Failed to update payment status' }
    }

    if (!updatedPayment) return { success: true, alreadyProcessed: true }

    // 3. Get User and current expiry
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, agent_expires_at, email, first_name, phone_number')
        .eq('id', payment.user_id)
        .single()

    const user = userData as any

    if (userError || !user) {
        console.error('[UpgradeProcess] User not found:', payment.user_id)
        return { success: false, error: 'User not found' }
    }

    // 4. Calculate new expiry
    const isPermanent = (payment.metadata as any)?.plan_type === 'permanent';
    const planDays = (payment.metadata as any)?.plan_days || 30
    const now = new Date()
    let currentExpiry = user.agent_expires_at ? new Date(user.agent_expires_at) : null
    let newExpiry: Date | null = null;

    if (!isPermanent) {
        if (currentExpiry && currentExpiry > now) {
            // Extend existing
            newExpiry = new Date(currentExpiry.getTime() + (planDays * 24 * 60 * 60 * 1000))
        } else {
            // Start fresh
            newExpiry = new Date(now.getTime() + (planDays * 24 * 60 * 60 * 1000))
        }
    }

    // 5. Update user role and expiry
    const { error: updateUserError } = await (supabase
        .from('users') as any)
        .update({
            role: 'agent',
            agent_expires_at: isPermanent ? null : newExpiry?.toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', payment.user_id)

    if (updateUserError) {
        console.error('[UpgradeProcess] Update user error:', updateUserError)
        return { success: false, error: 'Failed to update user role' }
    }

    // 6. Create notification
    await (supabase.from('notifications') as any).insert({
        user_id: payment.user_id,
        title: isPermanent ? 'Permanent Agent Unlocked! 💎' : 'Upgrade Successful',
        message: isPermanent 
            ? 'Congratulations! You now have lifetime access to premium agent benefits.' 
            : `Congratulations! Your Agent membership has been ${currentExpiry && currentExpiry > now ? 'extended' : 'activated'} until ${newExpiry?.toLocaleDateString()}.`,
        type: 'system',
        action_url: '/dashboard',
    })

    // Send push notification for upgrade
    try {
        const { sendPushNotification } = await import('@/lib/push-service')
        await sendPushNotification(payment.user_id, {
            title: isPermanent ? 'Permanent Agent Unlocked! 💎' : 'Upgrade Successful',
            body: isPermanent 
                ? 'Congratulations! You now have lifetime access to premium agent benefits.' 
                : `Congratulations! Your Agent membership has been activated/extended.`,
            url: '/dashboard'
        }).catch(err => console.error('[UpgradeProcess] Push error:', err))
    } catch (pushErr) {
        console.error('[UpgradeProcess] Failed to trigger push notification:', pushErr)
    }

    // 7. Send SMS notification
    try {
        if (user.phone_number) {
            if (isPermanent) {
                // Send Permanent/Lifetime notification (static import at top-level)
                await sendPermanentAgentUpgradeSuccessSMS(user.phone_number)
            } else if (newExpiry) {
                const planLabelText = (payment.metadata as any)?.plan_label ||
                    (planDays === 3 ? '3 Days' : planDays === 14 ? '14 Days' : '30 Days')

                // Calculate remaining days from now
                const diffMs = newExpiry.getTime() - now.getTime()
                const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

                // Check if it was an extension (user was already agent and didn't expire)
                if (currentExpiry && currentExpiry > now) {
                    // Extension
                    await sendAgentExtensionSuccessSMS(
                        user.phone_number,
                        newExpiry
                    )
                } else {
                    // New Upgrade
                    await sendAgentUpgradeSuccessSMS(
                        user.phone_number,
                        user.first_name || 'Agent',
                        planLabelText,
                        remainingDays,
                        newExpiry.toISOString() // Pass the expiry date
                    )
                }
            }
        }
    } catch (smsError) {
        console.error('[UpgradeProcess] SMS error:', smsError)
        // Don't fail the transaction if SMS fails
    }

    // 8. Send permanent agent upgrade email notification
    // Migrated from /api/payments/webhook (old route) — lines 140-147
    if (isPermanent && user.email) {
        try {
            await sendPermanentAgentUpgradeSuccessEmail(
                user.email,
                user.first_name || 'User'
            )
        } catch (emailError) {
            console.error('[UpgradeProcess] Permanent upgrade email error:', emailError)
            // Don't fail the transaction if email fails
        }
    }

    return { success: true }
}
