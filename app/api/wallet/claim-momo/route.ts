import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { sendWalletTopupSuccessSMS } from '@/lib/sms-service'
import { sendMomoClaimSuccessEmail, sendMomoClaimAdminAlert } from '@/lib/email-service'
import { createNotification, balanceUpdatedNotification } from '@/lib/notification-service'
import { waitUntil } from '@vercel/functions'
import { resolvePaystackFeePercent, resolveTopupLimits, parseSettingNumber } from '@/lib/paystack-fees'

// ── Claim-attempt limits ───────────────────────────────────────────
// MoMo transaction IDs are telco-assigned and roughly sequential, so someone
// holding one real ID (e.g. from their own top-up) could try nearby IDs hoping
// to land on another user's still-unclaimed transaction before its rightful
// owner claims it. The limits (3 attempts / 30s, 2 distinct failed IDs / hour,
// and a generous per-IP cap because signup is free) live in the
// reserve_momo_claim_attempt database function. It checks AND records the
// attempt under one per-user lock BEFORE the claim runs, so:
//   - parallel requests cannot all read "0 attempts" and slip through, and
//   - every outcome is recorded (the result column is updated once it is known).
// If the function errors we fail closed.

/** Maps the claim RPC's error strings onto the momo_claim_attempts.result values. */
function claimResultFor(errCode: string | undefined): string {
    if (!errCode) return 'claim_failed'
    if (errCode === 'Transaction not found') return 'not_found'
    if (errCode === 'already_claimed') return 'already_claimed'
    if (errCode === 'below_minimum') return 'below_minimum'
    if (errCode === 'Transaction has been voided by admin') return 'voided'
    if (errCode === 'Wallet not found') return 'wallet_not_found'
    if (errCode.startsWith('This transaction requires admin review')) return 'flagged'
    return 'claim_failed'
}

const LIMIT_MESSAGES: Record<string, string> = {
    rate_limited: 'Too many attempts. Please wait 30 seconds before trying again.',
    distinct_id_cap: 'You have tried a couple of different transaction IDs in the last hour. Double-check the digits from your MoMo confirmation SMS and try again in about an hour, or contact support.',
    ip_rate_limited: 'Too many failed claims from your network. Please try again later or contact support.',
}

function clientIp(request: NextRequest): string | null {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    return forwarded || request.headers.get('x-real-ip')?.trim() || null
}

// ── Input sanitization ───────────────────────────────────────────
function sanitizeTransactionId(raw: string): string | null {
    // Strip all non-digit characters
    const digits = raw.replace(/\D/g, '')
    // Validate length: must be 8-15 digits
    if (digits.length < 8 || digits.length > 15) return null
    return digits
}

// ── GET: Lookup step (Check a transaction ID) ────────────────────
export async function GET(request: NextRequest) {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // ── Settings-only mode: return display settings for wallet page ──
        // Called with ?settings_only=true — no txn_id required.
        // Uses service-role client to bypass RLS safely.
        const settingsOnly = request.nextUrl.searchParams.get('settings_only') === 'true'
        if (settingsOnly) {
            const supabaseAdmin = createServerClient()
            const { data: settingsRows } = await (supabaseAdmin
                .from('admin_settings') as any)
                .select('key, value')
                .in('key', [
                    'momo_claim_enabled',
                    'momo_payment_accounts',
                    'momo_account_name',
                    'momo_min_claimable',
                    'momo_max_claimable',
                    'paystack_fee_percent',
                    'paystack_fee_capped',
                    'agent_paystack_fee_percent',
                    'dealer_paystack_fee_percent',
                    'paystack_min_topup',
                    'paystack_max_topup'
                ])
            const map: Record<string, any> = {}
            ;((settingsRows as any[]) || []).forEach((s: any) => { map[s.key] = s.value })

            let accounts: { network: string; number: string }[] = []
            const rawAccts = map['momo_payment_accounts']
            if (Array.isArray(rawAccts)) accounts = rawAccts
            else if (typeof rawAccts === 'string') {
                try { const p = JSON.parse(rawAccts); if (Array.isArray(p)) accounts = p } catch {}
            }

            const rawName = map['momo_account_name']
            const accountName = typeof rawName === 'string' ? rawName.replace(/^\"|\"$/g, '') : String(rawName || '')

            // Determine effective fee based on user role
            const { data: userRoleData, error: userRoleError } = await supabaseAdmin
                .from('users')
                .select('role, agent_expires_at, dealer_expires_at')
                .eq('id', authUser.id)
                .single()

            if (userRoleError) {
                console.error('[ClaimMoMo] User role lookup failed, using base fee:', userRoleError.message)
                // Graceful degradation: return settings with base fee
            }

            const userRole = (userRoleData as any)?.role
            const agentExpiry = (userRoleData as any)?.agent_expires_at
            const dealerExpiry = (userRoleData as any)?.dealer_expires_at

            // Same resolver the charge route uses → displayed fee == charged fee.
            const effectiveFeePercent = resolvePaystackFeePercent({
                role: userRole,
                agentExpiresAt: agentExpiry,
                dealerExpiresAt: dealerExpiry,
            }, map)
            const { min: paystackMinTopup, max: paystackMaxTopup } = resolveTopupLimits(map)

            return NextResponse.json({
                momo_enabled: map['momo_claim_enabled'] !== 'false' && map['momo_claim_enabled'] !== false,
                momo_accounts: accounts,
                momo_account_name: accountName,
                momo_min_claimable: parseSettingNumber(map['momo_min_claimable'], 1),
                momo_max_claimable: parseSettingNumber(map['momo_max_claimable'], 50000),
                paystack_fee_percent: effectiveFeePercent,
                paystack_fee_capped: parseFloat(String(map['paystack_fee_capped']).replace(/^\"|\"$/g, '') || '0') || 0,
                paystack_min_topup: paystackMinTopup,
                paystack_max_topup: paystackMaxTopup,
            }, {
                headers: {
                    'Cache-Control': 'no-store, no-cache',
                }
            })
        }

        // VULN-08 fix: The GET lookup path is dead code since we switched to POST-only.
        // We block any GET requests containing a txn_id to prevent orphaned enumeration attacks.
        const hasTxnId = request.nextUrl.searchParams.has('txn_id')
        if (hasTxnId) {
            return NextResponse.json(
                { error: 'Endpoint no longer supports GET lookups. Use POST.' },
                { status: 410 }
            )
        }

        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    } catch (error: any) {
        console.error('[ClaimMoMo GET] Error:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── POST: Claim step ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user: authUser } } = await supabaseAuth.auth.getUser()

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const rawTxnId = body?.transaction_id || ''
        const txnId = sanitizeTransactionId(rawTxnId)

        if (!txnId) {
            return NextResponse.json(
                { error: 'Invalid Transaction ID. Must be 8–15 digits.' },
                { status: 400 }
            )
        }

        const supabaseAdmin = createServerClient()

        // ── Check if feature is enabled ────────────────────────
        // Before reserving an attempt, so a disabled feature doesn't burn anyone's quota.
        const { data: enabledSetting } = await (supabaseAdmin
            .from('admin_settings') as any)
            .select('value')
            .eq('key', 'momo_claim_enabled')
            .single()

        if ((enabledSetting as any)?.value === 'false' || (enabledSetting as any)?.value === false) {
            return NextResponse.json(
                { error: 'MoMo claim feature is currently unavailable.' },
                { status: 503 }
            )
        }

        // ── Reserve the attempt (atomic limit check + record) ───
        const { data: reservation, error: reserveError } = await (supabaseAdmin
            .rpc as any)('reserve_momo_claim_attempt', {
            p_user_id: authUser.id,
            p_transaction_id: txnId,
            p_ip: clientIp(request),
        })

        if (reserveError || !reservation) {
            // Fail closed: if we cannot enforce the limits, we do not run the claim.
            console.error('[ClaimMoMo POST] reserve_momo_claim_attempt failed:', reserveError?.message)
            return NextResponse.json(
                { error: 'Claims are temporarily unavailable. Please try again shortly.' },
                { status: 503 }
            )
        }

        if (!reservation.allowed) {
            return NextResponse.json(
                { error: LIMIT_MESSAGES[reservation.reason as string] || 'Too many attempts. Please try again later.' },
                { status: 429 }
            )
        }

        const attemptId: string = reservation.attempt_id
        const recordResult = async (result: string) => {
            const { error } = await (supabaseAdmin.from('momo_claim_attempts') as any)
                .update({ result })
                .eq('id', attemptId)
            // The row already exists as 'attempt' (which the limits still count), so a
            // failure here only loses the final label, never the protection.
            if (error) console.error('[ClaimMoMo POST] Failed to record attempt result:', error.message)
        }

        // ── Call the atomic PostgreSQL RPC ─────────────────────
        // ONLY transaction_id and user_id are sent — NO amounts from client
        const { data: result, error: rpcError } = await (supabaseAdmin
            .rpc as any)('claim_momo_transaction', {
            p_transaction_id: txnId,
            p_user_id: authUser.id,
        })

        if (rpcError) {
            console.error('[ClaimMoMo POST] RPC error:', rpcError)
            await recordResult('claim_failed')
            return NextResponse.json({ error: 'Failed to process claim. Please try again.' }, { status: 500 })
        }

        const res = result as any

        if (!res?.success) {
            const errCode: string | undefined = res?.error
            await recordResult(claimResultFor(errCode))

            if (errCode === 'already_claimed') {
                return NextResponse.json({
                    error: 'already_claimed',
                    is_own_claim: res.is_own_claim,
                    claimed_at: res.claimed_at,
                }, { status: 409 })
            }

            if (errCode === 'below_minimum') {
                return NextResponse.json({
                    error: `Below minimum claimable amount of GHS ${parseFloat(res.min_claimable).toFixed(2)}.`,
                }, { status: 400 })
            }

            if (errCode === 'Transaction not found') {
                return NextResponse.json({
                    error: "We couldn't find that transaction. Check the ID, and if you only just sent the money, wait a minute and try again.",
                }, { status: 404 })
            }

            if (errCode === 'Transaction has been voided by admin') {
                return NextResponse.json({ error: 'This transaction was voided. Please contact support.' }, { status: 400 })
            }

            // The flagged-for-review message is written for users; anything else is
            // internal and must not be echoed back.
            if (errCode?.startsWith('This transaction requires admin review')) {
                return NextResponse.json({ error: errCode }, { status: 400 })
            }

            return NextResponse.json({ error: 'That claim did not go through. Please try again or contact support.' }, { status: 400 })
        }

        await recordResult('claimed_successfully')

        // Decorate the user's open Send & Claim session, if the manual fallback (pasting
        // a transaction ID) is what resolved it rather than the SMS-forward auto-claim.
        // Same non-fatal posture as the webhook's copy of this — see that file's comment.
        try {
            // momo_claim_sessions is new enough that the generated Database type doesn't
            // know it yet; `as any` on the client itself is what bypasses the typed
            // `.from()` overload — casting only the query result errors first.
            const sessionsDb: any = supabaseAdmin
            const { data: openSession } = await sessionsDb
                .from('momo_claim_sessions')
                .select('id')
                .eq('user_id', authUser.id)
                .eq('status', 'pending')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (openSession) {
                const { data: txnRow } = await (supabaseAdmin
                    .from('momo_transactions') as any)
                    .select('id')
                    .eq('transaction_id', txnId)
                    .single()

                if (txnRow) {
                    await sessionsDb.from('momo_claim_sessions')
                        .update({ status: 'credited', momo_transaction_id: txnRow.id, updated_at: new Date().toISOString() })
                        .eq('id', openSession.id)
                        .eq('status', 'pending')
                }
            }
        } catch (sessionError: any) {
            console.error('[ClaimMoMo POST] Session linking error (non-fatal):', sessionError.message)
        }

        // ── Fetch user details for notifications ───────────────
        const { data: userDetails } = await supabaseAdmin
            .from('users')
            .select('first_name, last_name, phone_number, email')
            .eq('id', authUser.id)
            .single()

        const firstName = (userDetails as any)?.first_name || 'User'
        const phoneNumber = (userDetails as any)?.phone_number
        const email = (userDetails as any)?.email

        // Create in-app notification
        waitUntil(
            createNotification({
                userId: authUser.id,
                ...balanceUpdatedNotification(parseFloat(res.net_amount), 'credit'),
                message: `Your wallet was credited GHS ${parseFloat(res.net_amount).toFixed(2)} from MoMo TXN: ${res.transaction_id}`,
            }).catch(e => console.error('[ClaimMoMo] In-app notification error:', e.message))
        )
 
        // ── Fire SMS + Email notifications (non-blocking) ──────
        const notificationPayload = {
            netAmount:       parseFloat(res.net_amount),
            newBalance:      parseFloat(res.new_balance),
            transactionId:   res.transaction_id,
            senderNetwork:   res.sender_network,
        }

        const emailPayload = {
            transactionId:  res.transaction_id,
            senderName:     res.sender_name,
            senderNetwork:  res.sender_network,
            amount:         parseFloat(res.amount),
            feePercent:     parseFloat(res.fee_percent),
            feeAmount:      parseFloat(res.fee_amount),
            netAmount:      parseFloat(res.net_amount),
            newBalance:     parseFloat(res.new_balance),
        }

        // Background execution — Vercel won't freeze the server until these complete
        if (phoneNumber) {
            waitUntil(
                sendWalletTopupSuccessSMS(phoneNumber, {
                    amount: parseFloat(res.net_amount),
                    newBalance: parseFloat(res.new_balance)
                }).catch((e: any) =>
                    console.error('[ClaimMoMo] SMS error:', e.message)
                )
            )
        }
        if (email) {
            waitUntil(
                sendMomoClaimSuccessEmail(email, firstName, emailPayload).catch((e: any) =>
                    console.error('[ClaimMoMo] Email error:', e.message)
                )
            )
            waitUntil(
                sendMomoClaimAdminAlert({
                    userName: firstName + ' ' + ((userDetails as any)?.last_name || ''),
                    userEmail: email,
                    transactionId: res.transaction_id,
                    amount: parseFloat(res.amount),
                    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                }).catch((e: any) =>
                    console.error('[ClaimMoMo] Admin Email error:', e.message)
                )
            )
        }
        
        waitUntil(
            (async () => {
                const { sendAdminPushNotification } = await import('@/lib/push-service')
                await sendAdminPushNotification({
                    title: 'New MoMo Claim',
                    body: `${firstName} has successfully claimed GHS ${parseFloat(res.amount).toFixed(2)}.`,
                    url: '/admin/momo-claims'
                }).catch(err => console.error('[ClaimMoMo] Admin Push error:', err))
            })()
        )

        return NextResponse.json({
            success: true,
            amount:         parseFloat(res.amount),
            fee_percent:    parseFloat(res.fee_percent),
            fee_amount:     parseFloat(res.fee_amount),
            net_amount:     parseFloat(res.net_amount),
            new_balance:    parseFloat(res.new_balance),
            sender_name:    res.sender_name,
            sender_network: res.sender_network,
            transaction_id: res.transaction_id,
        })

    } catch (error: any) {
        console.error('[ClaimMoMo POST] Exception:', error.message)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
