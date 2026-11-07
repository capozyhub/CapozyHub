import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'
import { parseMoneyAmount, resolvePaystackFeePercent, resolveTopupLimits, roundMoney } from '@/lib/paystack-fees'

const GHANA_NETWORK_MAP: Record<string, string> = {
    '024': 'MTN', '025': 'MTN', '053': 'MTN', '054': 'MTN', '055': 'MTN', '059': 'MTN',
    '020': 'VOD', '050': 'VOD',
    '026': 'ATL', '027': 'ATL', '056': 'ATL', '057': 'ATL',
}

export async function POST(request: NextRequest) {
    try {
        if (process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true') {
            return NextResponse.json(
                { error: 'Payment system is currently under maintenance.' },
                { status: 503 }
            )
        }

        const supabase = await createRouteClient()
        const supabaseAdmin = createServerClient()

        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { amount: rawAmount, phone, provider } = await request.json()

        // Strict type check: a string amount would make `amount + fee` below
        // concatenate instead of add, corrupting the charged total. More than 2
        // decimals is rejected so the stored amount, the Paystack kobo total and the
        // credited balance can never disagree by a rounding step. The configurable
        // min/max band is enforced after admin settings load.
        const amount = parseMoneyAmount(rawAmount)
        if (amount === null) {
            return NextResponse.json({ error: 'Enter a valid amount (up to 2 decimal places)' }, { status: 400 })
        }

        if (!phone || !/^0[0-9]{9}$/.test(phone)) {
            return NextResponse.json(
                { error: 'Enter a valid Ghana mobile number (e.g. 0241234567)' },
                { status: 400 }
            )
        }

        const VALID_PROVIDERS = ['MTN', 'VOD', 'ATL']
        const providedProvider = provider && VALID_PROVIDERS.includes(provider) ? provider : null
        const detectedProvider = GHANA_NETWORK_MAP[phone.slice(0, 3)] ?? null
        const resolvedProvider = providedProvider ?? detectedProvider

        if (!resolvedProvider) {
            return NextResponse.json(
                { error: 'Could not detect network. Please select your network manually.', needsManualSelection: true },
                { status: 400 }
            )
        }

        const userId = authUser.id

        const { data: userData, error: userDataError } = await supabaseAdmin
            .from('users')
            .select('email, role, dealer_expires_at, agent_expires_at')
            .eq('id', userId)
            .single()

        if (userDataError) {
            console.error('[ChargeInit] User lookup failed:', userDataError.message)
            // non-blocking — continue with authUser.email and base fee
        }

        const email = (userData as any)?.email || authUser.email

        // Fix 6: guard against undefined email
        if (!email) {
            return NextResponse.json({ error: 'Account email is required for payment' }, { status: 400 })
        }

        const { data: settingsRows } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', [
                'paystack_fee_percent',
                'agent_paystack_fee_percent',
                'dealer_paystack_fee_percent',
                'paystack_min_topup',
                'paystack_max_topup',
            ])
        const settings: Record<string, unknown> = {}
        ;((settingsRows as any[]) || []).forEach((s: any) => { settings[s.key] = s.value })

        // Enforce admin-configured top-up band (server is authoritative).
        const { min, max } = resolveTopupLimits(settings)
        if (amount < min || amount > max) {
            return NextResponse.json(
                { error: `Amount must be between GHS ${min} and GHS ${max.toLocaleString()}` },
                { status: 400 },
            )
        }

        const feePercent = resolvePaystackFeePercent({
            role: (userData as any)?.role,
            agentExpiresAt: (userData as any)?.agent_expires_at,
            dealerExpiresAt: (userData as any)?.dealer_expires_at,
        }, settings)

        const fee = calculatePaystackFee(amount, feePercent)
        const totalAmount = roundMoney(amount + fee)
        const reference = `WAL-${generateReferenceCode()}`

        // ── Anti-abuse: reserve the payment atomically ─────────────────────
        // Each charge fires a real MoMo prompt at whatever number the caller
        // typed. The DB function checks the pending cap, a daily cap, the number of
        // distinct numbers per user, and a per-number cap across ALL accounts, and
        // inserts the row under one lock — so a burst of parallel requests cannot all
        // pass a count-then-insert check. It also creates the wallet if missing.
        const { data: reservation, error: reserveError } = await (supabaseAdmin as any).rpc('reserve_wallet_payment', {
            p_user_id: userId,
            p_amount: amount,
            p_fee: fee,
            p_total: totalAmount,
            p_reference: reference,
            p_phone: phone,
            p_network: resolvedProvider,
        })

        if (reserveError || !reservation) {
            console.error('[ChargeInit] reserve_wallet_payment failed:', reserveError)
            return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
        }

        if (!reservation.ok) {
            const LIMIT_MESSAGES: Record<string, string> = {
                too_many_pending: 'You have too many pending payments. Finish or wait for them to expire before starting a new one.',
                daily_limit: 'You have reached the daily limit for payment requests. Please try again tomorrow.',
                too_many_numbers: 'You can use up to 3 different mobile money numbers per day. Use one of your recent numbers, or try again tomorrow.',
                number_limited: 'Too many payment requests were sent to this number recently. Please wait an hour and try again.',
            }
            const message = LIMIT_MESSAGES[reservation.reason as string]
            if (!message) {
                console.error('[ChargeInit] reserve_wallet_payment refused:', reservation)
                return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
            }
            return NextResponse.json({ error: message }, { status: 429 })
        }

        const paymentId: string = reservation.payment_id

        // A definite failure from Paystack means no prompt was sent and no success
        // webhook can follow, so the row is closed immediately. (Otherwise failed
        // attempts sit as "pending" and lock the user out of the pending cap.)
        const markFailed = () =>
            (supabaseAdmin.from('wallet_payments') as any)
                .update({ status: 'failed', updated_at: new Date().toISOString() })
                .eq('id', paymentId)
                .eq('status', 'pending')

        let paystackData: any
        try {
            const paystackRes = await fetch('https://api.paystack.co/charge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    amount: Math.round(totalAmount * 100),
                    currency: 'GHS',
                    reference,
                    mobile_money: { phone, provider: resolvedProvider },
                }),
                signal: AbortSignal.timeout(25_000),
            })
            paystackData = await paystackRes.json()
        } catch (fetchError) {
            // Timeout / network error: the outcome is UNKNOWN — Paystack may already have
            // sent the prompt. Do not mark the row failed, or a late success webhook
            // would find a failed row and the customer would be charged but not credited.
            // It stays pending and ages out of the cap window.
            console.error('[ChargeInit] Paystack request failed:', fetchError)
            return NextResponse.json(
                { error: 'We could not confirm your payment request. If you receive a prompt on your phone, approve it and your wallet will be credited automatically.' },
                { status: 502 }
            )
        }

        if (!paystackData.status) {
            console.error('[ChargeInit] Paystack charge failed:', paystackData)
            await markFailed()
            return NextResponse.json({ error: 'Failed to initiate charge' }, { status: 500 })
        }

        if (!paystackData.data) {
            console.error('[ChargeInit] Paystack charge response missing data:', paystackData)
            await markFailed()
            return NextResponse.json({ error: 'Unexpected response from payment processor' }, { status: 500 })
        }

        const chargeStatus: string = paystackData.data.status
        const displayText: string = paystackData.data.display_text || paystackData.data.message || ''

        if (chargeStatus === 'failed') {
            await markFailed()
        } else {
            await (supabaseAdmin.from('wallet_payments') as any)
                .update({ provider_reference: paystackData.data.reference || reference })
                .eq('id', paymentId)
        }

        return NextResponse.json({
            status: chargeStatus,
            reference,
            display_text: displayText,
            fee,
            total_amount: totalAmount,
        })
    } catch (error) {
        console.error('[ChargeInit] Unhandled error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
