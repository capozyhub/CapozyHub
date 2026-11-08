import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import {
    processWalletUpgrade,
    fetchUpgradePrice,
    isValidPlan,
    UpgradeInputError,
    UpgradePricingError,
} from '@/lib/wallet-upgrade'
import type { UpgradeType } from '@/lib/wallet-upgrade'

// Client-generated per purchase attempt; a retry with the same key never charges twice.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/

const FAILURE_STATUS: Record<string, number> = {
    INVALID_PLAN: 400,
    INVALID_PRICE: 400,
    NOT_ELIGIBLE: 403,
    ACCOUNT_INACTIVE: 403,
    ALREADY_LIFETIME: 409,
    IDEMPOTENCY_KEY_REUSED: 409,
}

export async function POST(request: Request) {
    try {
        const supabase = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json().catch(() => null)
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        if (body.upgrade_type !== 'agent' && body.upgrade_type !== 'dealer') {
            return NextResponse.json({ error: 'upgrade_type must be "agent" or "dealer"' }, { status: 400 })
        }
        const upgradeType: UpgradeType = body.upgrade_type

        if (!isValidPlan(upgradeType, body.plan)) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
        }
        const plan = body.plan

        if (typeof body.idempotency_key !== 'string' || !IDEMPOTENCY_KEY_RE.test(body.idempotency_key)) {
            return NextResponse.json({ error: 'A valid idempotency_key is required' }, { status: 400 })
        }

        if (typeof body.expected_price !== 'number' || !Number.isFinite(body.expected_price)) {
            return NextResponse.json({ error: 'expected_price is required' }, { status: 400 })
        }

        // Price must ALWAYS come from admin_settings — never trust client-supplied price
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { price, planLabel } = await fetchUpgradePrice(upgradeType, plan, supabaseAdmin)

        // The client only confirms the price it showed the user. If it is stale (admin changed
        // the price, or the page fell back to a cached value), refuse rather than charge a
        // different amount than the one the user agreed to.
        if (Math.abs(price - body.expected_price) > 0.005) {
            return NextResponse.json(
                {
                    error: 'The price has changed. Please review the new price and try again.',
                    code: 'PRICE_CHANGED',
                    currentPrice: price,
                },
                { status: 409 }
            )
        }

        const result = await processWalletUpgrade({
            userId: authUser.id,
            upgradeType,
            plan,
            price,
            planLabel,
            isAutoUpgrade: false,
            idempotencyKey: body.idempotency_key,
        })

        if (!result.success) {
            if (result.insufficientBalance) {
                return NextResponse.json(
                    {
                        error: 'Insufficient wallet balance',
                        insufficientBalance: true,
                        currentBalance: result.currentBalance,
                        requiredAmount: result.requiredAmount,
                        shortfall: (result.requiredAmount ?? 0) - (result.currentBalance ?? 0),
                    },
                    { status: 402 }
                )
            }
            const status = FAILURE_STATUS[result.code ?? ''] ?? 500
            return NextResponse.json({ error: result.error ?? 'Upgrade failed', code: result.code }, { status })
        }

        return NextResponse.json({
            success: true,
            newExpiry: result.newExpiry,
            planLabel,
            alreadyProcessed: result.alreadyProcessed ?? false,
        })
    } catch (err: any) {
        if (err instanceof UpgradeInputError) {
            return NextResponse.json({ error: err.message }, { status: 400 })
        }
        if (err instanceof UpgradePricingError) {
            return NextResponse.json({ error: err.message }, { status: 503 })
        }
        console.error('[WalletUpgradeRoute] Error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
