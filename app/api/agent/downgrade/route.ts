import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Fetch current user data
        const { data: user, error: fetchError } = await (supabase
            .from('users') as any)
            .select('id, role, agent_expires_at')
            .eq('id', authUser.id)
            .single()

        if (fetchError || !user) {
            console.error('[AgentDowngrade] User fetch error:', fetchError)
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Verify user is currently an agent
        if (user.role !== 'agent') {
            return NextResponse.json({ error: 'User is not an agent' }, { status: 400 })
        }

        // Update user role to customer and clear agent_expires_at
        const { error: updateError } = await (supabase
            .from('users') as any)
            .update({
                role: 'customer',
                agent_expires_at: null,
                // A deliberate step-down must stick. Left on, the auto-upgrade cron treats every
                // customer with the flag as due and would re-buy the membership from their wallet.
                auto_upgrade_enabled: false,
                auto_upgrade_plan: null,
            })
            .eq('id', authUser.id)

        if (updateError) {
            console.error('[AgentDowngrade] Update error:', updateError)
            throw updateError
        }

        // Re-sync shop pricing to the customer cost basis. Upgrades now reprice on the way up
        // (process_wallet_upgrade), so the way down must too or margins drift. Non-blocking but
        // logged, same as the dealer downgrade and the expiry cron.
        try {
            const { error: repriceError } = await (supabase as any)
                .rpc('adjust_shop_pricing_for_role_change', {
                    p_user_id: authUser.id,
                    p_old_role: 'agent',
                    p_new_role: 'customer',
                })
            if (repriceError) {
                console.error('[AgentDowngrade] reprice FAILED (manual reconcile needed):', repriceError)
            }
        } catch (repriceErr) {
            console.error('[AgentDowngrade] reprice threw (non-fatal):', repriceErr)
        }

        // Reset shop fee overrides so the shop inherits the customer global settings.
        // This is non-blocking — a failure here does not prevent the downgrade from completing.
        try {
            await (supabase
                .from('shop_profiles') as any)
                .update({
                    paystack_fee_percent:   null,
                    withdrawal_fee_percent: null,
                    withdrawal_fee_flat:    null,
                    min_withdrawal_amount:  null,
                    updated_at: new Date().toISOString(),
                })
                .eq('owner_id', authUser.id)
            console.log(`[AgentDowngrade] Shop fee overrides reset for user ${authUser.id}`)
        } catch (resetErr) {
            console.error('[AgentDowngrade] Failed to reset shop fee overrides (non-fatal):', resetErr)
        }

        console.log(`[AgentDowngrade] User ${authUser.id} downgraded to customer`)

        return NextResponse.json({
            success: true,
            message: 'Successfully returned to customer role'
        })
    } catch (error: any) {
        console.error('Agent Downgrade Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
