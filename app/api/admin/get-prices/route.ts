import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { fetchActiveRolePlans, type RoleUpgradePlanRow } from '@/lib/wallet-upgrade'

export const dynamic = 'force-dynamic'

// Keys safe to return to unauthenticated (public) callers
const PUBLIC_KEYS = [
    'guest_storefront_url',
    'whatsapp_group_link',
    'whatsapp_channel_link',
    'whatsapp_admin_number',
    'whatsapp_community_link',
] as const

const toDTO = (p: RoleUpgradePlanRow) => ({
    id: p.id,
    slug: p.slug,
    label: p.label,
    days: p.duration_days,
    price: Number(p.price),
    oldPrice: p.old_price === null ? 0 : Number(p.old_price),
    popular: p.is_popular,
})

export async function GET(request: NextRequest) {
    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // ── Determine caller auth status ───────────────────────────
        let isAuthenticated = false
        try {
            const cookieStore = await cookies()
            const supabaseUser = await createRouteClient()
            const { data: { user } } = await supabaseUser.auth.getUser()
            isAuthenticated = !!user
        } catch {
            // Treat auth errors as unauthenticated — do not leak data
            isAuthenticated = false
        }

        const { data, error } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', PUBLIC_KEYS)

        if (error) {
            console.error('[get-prices] DB error:', { code: error.code, message: error.message })
            return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 })
        }

        const find = (key: string): string => data?.find(s => s.key === key)?.value ?? ''

        // ── Public fields (always returned) ───────────────────────
        const publicPayload = {
            guestStorefrontUrl: find('guest_storefront_url') || 'https://capozygh.com/shop/felix-s-shop',
            whatsappGroupLink: find('whatsapp_group_link'),
            whatsappChannelLink: find('whatsapp_channel_link'),
            whatsappAdminNumber: find('whatsapp_admin_number'),
            whatsappCommunityLink: find('whatsapp_community_link'),
        }

        if (!isAuthenticated) {
            // Unauthenticated — only return public link data
            return NextResponse.json({
                ...publicPayload,
                prices: null,
                oldPrices: null,
                agentPlans: [],
                dealerPlans: [],
            }, {
                headers: { 'Cache-Control': 'no-store' }
            })
        }

        // ── Plans (authenticated callers only) ─────────────────────
        const plans = await fetchActiveRolePlans(supabaseAdmin)
        const agentPlanRows = plans.filter(p => p.upgrade_type === 'agent')
        const dealerPlanRows = plans.filter(p => p.upgrade_type === 'dealer')

        const bySlug = (rows: RoleUpgradePlanRow[], slug: string) => rows.find(p => p.slug === slug)

        // Legacy flat fields — kept for AutoUpgradeQuickModal / AgentExpiryModal, which only
        // ever show a renewal estimate for these fixed codes (see lib/wallet-upgrade.ts).
        const prices = {
            '3d': Number(bySlug(agentPlanRows, '3d')?.price ?? 9.99),
            '14d': Number(bySlug(agentPlanRows, '14d')?.price ?? 49.99),
            '30d': Number(bySlug(agentPlanRows, '30d')?.price ?? 99.99),
            'permanent': Number(bySlug(agentPlanRows, 'permanent')?.price ?? 149.99),
        }
        const oldPrices = {
            '3d': Number(bySlug(agentPlanRows, '3d')?.old_price ?? 0),
            '14d': Number(bySlug(agentPlanRows, '14d')?.old_price ?? 0),
            '30d': Number(bySlug(agentPlanRows, '30d')?.old_price ?? 0),
            'permanent': Number(bySlug(agentPlanRows, 'permanent')?.old_price ?? 0),
        }
        const dealerPrice1m = Number(bySlug(dealerPlanRows, '1m')?.price ?? 99.99)
        const dealerPrice3m = Number(bySlug(dealerPlanRows, '3m')?.price ?? 199.99)
        const dealerPrice6m = Number(bySlug(dealerPlanRows, '6m')?.price ?? 299.99)

        return NextResponse.json({
            ...publicPayload,
            prices,
            oldPrices,
            dealerPrice: dealerPrice6m,
            dealerPrice1m,
            dealerPrice3m,
            agentPlans: agentPlanRows.map(toDTO),
            dealerPlans: dealerPlanRows.map(toDTO),
        }, {
            headers: { 'Cache-Control': 'private, no-store' }
        })

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error('[get-prices] Unexpected error:', msg)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

