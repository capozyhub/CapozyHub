import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { AGENT_PLANS, DEALER_PLANS } from '@/lib/wallet-upgrade'
import type { PlanType } from '@/lib/wallet-upgrade'

const VALID_PLANS: readonly string[] = [...AGENT_PLANS, ...DEALER_PLANS]
const isDealerPlan = (plan: string) => (DEALER_PLANS as readonly string[]).includes(plan)

export async function POST(request: Request) {
    try {
        const supabase = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const { enabled, plan } = body as { enabled: boolean; plan: PlanType }

        if (typeof enabled !== 'boolean') {
            return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
        }

        if (enabled && (typeof plan !== 'string' || !VALID_PLANS.includes(plan))) {
            return NextResponse.json(
                { error: `plan must be one of: ${VALID_PLANS.join(', ')}` },
                { status: 400 }
            )
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Validate plan matches user's role category
        const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('role, agent_expires_at')
            .eq('id', authUser.id)
            .single()

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const user = dbUser as any

        if (enabled) {
            // Only reseller-track accounts can auto-renew anything.
            if (user.role !== 'customer' && user.role !== 'agent' && user.role !== 'dealer') {
                return NextResponse.json({ error: 'Auto-upgrade is not available for this account type' }, { status: 403 })
            }

            const isDealer = user.role === 'dealer'
            const isLifetimeAgent = user.role === 'agent' && user.agent_expires_at === null

            // Dealer plans only valid for dealers and lifetime agents eligible for dealer
            if (isDealerPlan(plan) && !isDealer && !isLifetimeAgent) {
                return NextResponse.json(
                    { error: 'Dealer auto-upgrade requires Dealer or Lifetime Agent status' },
                    { status: 400 }
                )
            }

            // Agent-only plans are invalid for dealers
            if (!isDealerPlan(plan) && isDealer) {
                return NextResponse.json(
                    { error: 'Dealers must use a dealer plan (1m, 3m, or 6m) for auto-upgrade' },
                    { status: 400 }
                )
            }

            // Lifetime agents have nothing to renew on the agent tier (this also covers
            // 'permanent', a one-time purchase) — only a dealer plan makes sense for them.
            if (isLifetimeAgent && !isDealerPlan(plan)) {
                return NextResponse.json(
                    { error: 'You already have permanent access — no auto-upgrade needed' },
                    { status: 400 }
                )
            }
        }

        const { error: updateError } = await (supabaseAdmin
            .from('users') as any)
            .update({
                auto_upgrade_enabled: enabled,
                auto_upgrade_plan: enabled ? plan : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', authUser.id)

        if (updateError) {
            console.error('[ToggleAutoUpgrade] DB error:', updateError)
            return NextResponse.json({ error: 'Failed to update auto-upgrade setting' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            auto_upgrade_enabled: enabled,
            auto_upgrade_plan: enabled ? plan : null,
        })
    } catch (err: any) {
        console.error('[ToggleAutoUpgrade] Error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
