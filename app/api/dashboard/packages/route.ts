import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createServerClient } from '@/lib/supabase'
import { resolveOwnerCost } from '@/lib/pricing/cost-basis'
import { loadBuyer } from '@/lib/data-orders/guards'

/**
 * GET /api/dashboard/packages: the bundles a signed-in member can buy, each with ONE price,
 * the member's own.
 *
 * data_packages also holds our supplier cost and the agent and dealer tiers. Those never
 * leave the server: the browser is not allowed to read them (see migration
 * 00000000000005), and this route sends back only `price` (the customer price, already public
 * on the storefronts) and `your_price` (what THIS member pays, worked out here from their
 * role and expiry, the same way the purchase route will charge it).
 *
 * A sub-agent's real price depends on what their recruiter set; the page overlays that from
 * /api/dashboard/subagents/my-pricing, so `your_price` for them is the customer price.
 */
export async function GET() {
    try {
        const supabaseUser = await createRouteClient()
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createServerClient()

        const buyerResult = await loadBuyer(supabase, user.id)
        if (!buyerResult.ok) {
            return NextResponse.json({ error: buyerResult.error }, { status: buyerResult.status })
        }
        const { buyer } = buyerResult

        const { data, error } = await (supabase.from('data_packages') as any)
            .select('id, network, size, description, category, sort_order, price, agent_price, dealer_price')
            .eq('is_available', true)
            .order('sort_order', { ascending: true })

        if (error) {
            console.error('[api/dashboard/packages] load failed:', error.message)
            return NextResponse.json({ error: 'Could not load the bundles' }, { status: 500 })
        }

        const ctx = {
            role: buyer.role,
            agent_expires_at: buyer.agent_expires_at,
            dealer_expires_at: buyer.dealer_expires_at,
        }
        const packages = (data ?? []).map((p: any) => ({
            id: p.id,
            network: p.network,
            size: p.size,
            description: p.description,
            category: p.category,
            sort_order: p.sort_order,
            price: Number(p.price),
            your_price: Math.round(resolveOwnerCost(p, ctx) * 100) / 100,
        }))

        return NextResponse.json({ packages }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('[api/dashboard/packages] GET failed:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
