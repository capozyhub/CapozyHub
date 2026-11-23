import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import ShopStorefront from '@/app/shop/[shopSlug]/ShopStorefront'
import { getAdminOOSNetworks, mergeOOS } from '@/lib/network-stock'
import { getShopUrl } from '@/lib/site-url'
import { StorefrontGate } from '@/components/storefront/gate'

interface Props {
    params: Promise<{ shopSlug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { shopSlug } = await params
    const supabase = createServerClient()

    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('shop_name, description, logo_url')
        .eq('shop_slug', shopSlug)
        .single() as any)

    if (!shop) {
        return { title: 'Shop Not Found' }
    }

    const shopBaseUrl = getShopUrl()
    return {
        metadataBase: new URL(shopBaseUrl),
        title: shop.shop_name,
        description: shop.description || `${shop.shop_name}: data bundles, airtime and results checkers.`,
        openGraph: {
            title: shop.shop_name,
            description: shop.description || `${shop.shop_name}: data bundles, airtime and results checkers.`,
            url: `${shopBaseUrl}/${shopSlug}`,
            siteName: shop.shop_name,
            images: shop.logo_url ? [
                {
                    url: shop.logo_url,
                    width: 800,
                    height: 800,
                    alt: shop.shop_name,
                }
            ] : [
                {
                    url: '/logo.png',
                    width: 1200,
                    height: 630,
                    alt: shop.shop_name,
                }
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: shop.shop_name,
            description: shop.description || `${shop.shop_name}: data bundles, airtime and results checkers.`,
            images: [shop.logo_url || '/logo.png'],
        },
        icons: {
            icon: shop.logo_url || '/favicon.ico',
        },
        alternates: {
            canonical: `${shopBaseUrl}/${shopSlug}`,
        },
        manifest: `/api/manifest?shop=${shopSlug}`,
    }
}

export default async function ShopDomainPage({ params }: Props) {
    const { shopSlug } = await params
    const supabase = createServerClient()

    // Fetch shop — include pricing_status so we can show Under Review state
    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('id, shop_name, shop_slug, description, owner_phone, owner_email, whatsapp_number, logo_url, community_link, divider_style, brand_color, brand_accent, approval_status, pricing_status, is_active, owner_id, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at, mashup_fee_percent, results_checker_markup_customer, ussd_code, ussd_active, oos_networks, utilities_enabled, afa_selling_price, paystack_fee_percent')
        .eq('shop_slug', shopSlug)
        .single() as any)

    // Note: session refresh is handled by middleware; no explicit call needed here

    // Shop doesn't exist or is explicitly deactivated → 404
    if (!shop || !shop.is_active) {
        notFound()
    }

    // Check Global Storefront Access Settings
    const { data: adminSettings } = await (supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', [
            'page_access_storefront', 'storefront_airtime_enabled', 'storefront_mashup_enabled',
            'airtime_fee_mtn_customer', 'airtime_fee_mtn_agent',
            'airtime_fee_telecel_customer', 'airtime_fee_telecel_agent',
            'airtime_fee_at_customer', 'airtime_fee_at_agent',
            'airtime_min_amount_customer', 'airtime_max_amount_customer',
            'mashup_min_amount_customer', 'mashup_max_amount_customer',
            'results_checker_enabled', 'results_checker_storefront_enabled', 'results_checker_paystack_fee_percent', 'results_checker_max_quantity', 'results_checker_allow_backorders',
            'airtime_enabled_mtn', 'airtime_enabled_telecel', 'airtime_enabled_at',
            'storefront_afa_enabled', 'afa_price_customer', 'afa_price_agent', 'afa_price_dealer',
        ]) as any)

    const adminSettingsMap: Record<string, any> = {}
    for (const row of adminSettings || []) {
        adminSettingsMap[row.key] = row.value
    }

    // AFA's per-shop-role Paystack fee override, merged into the same flat settings
    // map so ShopStorefront can mirror lib/shop-afa-checkout.ts's fee resolution
    // exactly for the pre-charge display price. MUST match app/shop/[shopSlug]/page.tsx.
    const { data: paystackFeeRows } = await (supabase
        .from('shop_global_settings')
        .select('key, value')
        .in('key', ['shop_paystack_fee_percent_customer', 'shop_paystack_fee_percent_agent', 'shop_paystack_fee_percent_dealer', 'shop_paystack_fee_percent']) as any)
    for (const row of paystackFeeRows || []) {
        adminSettingsMap[row.key] = row.value
    }

    // Check Global Storefront Access Settings
    const storefrontSetting = adminSettingsMap['page_access_storefront']

    // Block if globally disabled
    if (storefrontSetting === 'false') {
        return <StorefrontGate kind="maintenance" shop={shop} />
    }

    // Profile not approved OR pricing not yet approved → show Under Review page
    if (shop.approval_status !== 'approved' || shop.pricing_status !== 'approved') {
        return <StorefrontGate kind="review" shop={shop} />
    }

    // Fetch live approved packages with shop pricing
    // Uses service role client to bypass RLS — only selling_price is exposed to client, never cost/profit
    const { data: pricingRows } = await (supabase
        .from('shop_pricing')
        .select('package_id, selling_price, data_packages(id, network, size, description, sort_order, is_available)')
        .eq('shop_id', shop.id) as any)

    const packages = (pricingRows || [])
        .filter((row: any) => row.data_packages?.is_available)
        .map((row: any) => ({
            id: row.data_packages.id,
            network: row.data_packages.network,
            size: row.data_packages.size,
            description: row.data_packages.description || null,
            sort_order: row.data_packages.sort_order ?? 999,
            selling_price: parseFloat(row.selling_price),
        }))
        .sort((a: any, b: any) => a.network.localeCompare(b.network) || a.sort_order - b.sort_order)

    // Append owner role to calculate correct max amount limits client side
    let ownerRole = 'customer'
    // Effective (expiry-aware) role for RC base pricing, so the displayed RC price matches what the
    // charge route computes for an expired reseller. Separate from `ownerRole` (airtime limits).
    let rcOwnerRole = 'customer'
    if (shop?.owner_id) {
        const { data: uData } = await supabase.from('users').select('role, dealer_expires_at, agent_expires_at').eq('id', shop.owner_id).single()
        ownerRole = (uData as any)?.role || 'customer'
        const { effectiveRoleFromExpiry } = await import('@/lib/results-checker-service')
        rcOwnerRole = effectiveRoleFromExpiry((uData as any)?.role, (uData as any)?.agent_expires_at, (uData as any)?.dealer_expires_at)
    }

    // Fetch announcement server-side to eliminate client-side DB call per visitor
    let initialAnnouncement: { id: string; type: 'admin' | 'shop'; message: string; title?: string } | null = null
    const { data: adminAnn } = await (supabase as any)
        .from('system_announcements')
        .select('id, title, message')
        .eq('is_active', true)
        .in('visible_on', ['storefronts', 'both'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (adminAnn) {
        initialAnnouncement = { id: adminAnn.id, type: 'admin', title: adminAnn.title, message: adminAnn.message }
    } else {
        const { data: shopAnn } = await (supabase as any)
            .from('shop_announcements')
            .select('id, message')
            .eq('shop_id', shop.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        if (shopAnn) {
            initialAnnouncement = { id: shopAnn.id, type: 'shop', message: shopAnn.message }
        }
    }

    // Fetch RC types server-side when RC is globally enabled
    let rcTypes: Array<{ id: string; name: string; customer_price: number; available_count?: number }> = []
    let rcMarkups: Record<string, number> = {}
    if (adminSettingsMap['results_checker_storefront_enabled'] === 'true') {
        const { getAvailableTypes, getPriceForRole } = await import('@/lib/results-checker-service')
        // The storefront displays — and the charge route computes — the OWNER-ROLE base price
        // (dealer/agent/customer via getPriceForRole), NOT the literal customer_price. A reseller
        // shop sells at agent/dealer_price + markup, so showing customer_price here would display a
        // price the guest is never charged. Resolve the effective base into `customer_price`.
        // MUST match app/shop/[shopSlug]/page.tsx (this subdomain is the primary public domain).
        rcTypes = (await getAvailableTypes()).map((t: any) => ({
            id: t.id,
            name: t.name,
            customer_price: getPriceForRole(t, rcOwnerRole),
            available_count: t.available_count,
            bulk_pricing: t.bulk_pricing,
        }))

        // Per-exam-type markups override the legacy single markup. MUST match the
        // main /shop page — without this the subdomain (the primary public domain)
        // displays wrong RC prices that disagree with the server-charged amount.
        const { data: markupRows } = await (supabase as any)
            .from('shop_rc_markups')
            .select('exam_type_id, markup')
            .eq('shop_id', shop.id)
        for (const row of (markupRows as any[]) || []) {
            rcMarkups[row.exam_type_id] = parseFloat(String(row.markup)) || 0
        }
    }

    // Compute merged OOS set: admin global ∪ this shop's own hidden networks
    const adminOOS = await getAdminOOSNetworks(supabase)
    const oosNetworks = [...mergeOOS(adminOOS, shop.oos_networks)]

    return <ShopStorefront
        shop={{ ...shop, ownerRole }}
        packages={packages}
        adminSettings={adminSettingsMap}
        initialAnnouncement={initialAnnouncement}
        rcTypes={rcTypes}
        rcMarkup={parseFloat(String(shop.results_checker_markup_customer || 0))}
        rcMarkups={rcMarkups}
        oosNetworks={oosNetworks}
    />
}
