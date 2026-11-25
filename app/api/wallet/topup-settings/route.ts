import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { resolvePaystackFeePercent, resolveTopupLimits } from '@/lib/paystack-fees'

// GET /api/wallet/topup-settings — the Paystack fee and top-up limits the wallet page shows.
// Uses the same resolvers as the charge route, so the fee a user sees is the fee they pay.
export async function GET() {
    try {
        const supabaseAuth = await createRouteClient()
        const { data: { user } } = await supabaseAuth.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createServerClient()
        const [{ data: settingsRows }, { data: userRow, error: userError }] = await Promise.all([
            (admin.from('admin_settings') as any)
                .select('key, value')
                .in('key', [
                    'paystack_fee_percent',
                    'agent_paystack_fee_percent',
                    'dealer_paystack_fee_percent',
                    'paystack_min_topup',
                    'paystack_max_topup',
                ]),
            admin
                .from('users')
                .select('role, agent_expires_at, dealer_expires_at')
                .eq('id', user.id)
                .single(),
        ])
        if (userError) {
            // Falls back to the base fee, the same way the charge route degrades.
            console.error('[TopupSettings] role lookup failed:', userError.message)
        }

        const map: Record<string, unknown> = {}
        for (const row of (settingsRows as any[]) || []) map[row.key] = row.value

        const u = userRow as any
        const { min, max } = resolveTopupLimits(map)
        return NextResponse.json({
            paystack_fee_percent: resolvePaystackFeePercent({
                role: u?.role,
                agentExpiresAt: u?.agent_expires_at,
                dealerExpiresAt: u?.dealer_expires_at,
            }, map),
            paystack_min_topup: min,
            paystack_max_topup: max,
        }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error: any) {
        console.error('[TopupSettings] error:', error?.message)
        return NextResponse.json({ error: 'Could not load top-up settings' }, { status: 500 })
    }
}
