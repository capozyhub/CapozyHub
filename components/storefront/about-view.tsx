import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BookOpen, Mail, MessageCircle, Phone, Users, type LucideIcon } from 'lucide-react'
import { createServerClient } from '@/lib/supabase'
import { CopyrightFooter } from '@/components/CopyrightFooter'
import { TermsSectionsLive } from '@/components/terms/terms-sections-live'
import { StorefrontPageFrame } from './page-frame'

export async function aboutMetadata(shopSlug: string): Promise<Metadata> {
    const supabase = createServerClient()
    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('shop_name')
        .eq('shop_slug', shopSlug)
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .single() as any)
    if (!shop) return { title: 'Not Found' }
    return {
        title: `About ${shop.shop_name}`,
        description: `Who runs ${shop.shop_name}, how to reach them, and the terms you agree to when you buy.`,
    }
}

const ROW = 'neu-raised-sm neu-press flex items-center gap-4 rounded-2xl px-4 py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

function ContactRow({ href, icon: Icon, label, value, external }: { href: string; icon: LucideIcon; label: string; value: string; external?: boolean }) {
    return (
        <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={ROW}>
            <span className="clay-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-full"><Icon className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">{label}</span>
                <span className="block truncate text-sm font-semibold text-foreground">{value}</span>
            </span>
        </a>
    )
}

/** Shared by /shop/[slug]/about and the shop-domain route. */
export async function StorefrontAbout({ shopSlug, basePath }: { shopSlug: string; basePath: '/shop' | '' }) {
    const supabase = createServerClient()

    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('shop_name, description, owner_phone, owner_email, whatsapp_number, logo_url, community_link, brand_color')
        .eq('shop_slug', shopSlug)
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .single() as any)

    if (!shop) notFound()

    const { data: adminSettings } = await (supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['copyright_footer_enabled', 'copyright_footer_text', 'copyright_footer_link_url', 'copyright_footer_link_text']) as any)

    const settingsMap: Record<string, string> = {}
    for (const row of adminSettings || []) settingsMap[row.key] = row.value

    const home = basePath ? `${basePath}/${shopSlug}` : `/${shopSlug}`

    return (
        <StorefrontPageFrame name={shop.shop_name} logoUrl={shop.logo_url} brandColor={shop.brand_color} backHref={home} backLabel="Back to shop">
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground">About this shop</h1>
            {shop.description
                ? <p className="mt-3 text-base leading-relaxed text-muted-foreground">{shop.description}</p>
                : <p className="mt-3 text-base leading-relaxed text-muted-foreground">{shop.shop_name} has not written an introduction yet. You can still reach them below.</p>}

            <h2 className="mb-3 mt-8 font-display text-xl font-bold tracking-tight text-foreground">Talk to them</h2>
            <div className="space-y-3">
                {shop.whatsapp_number && <ContactRow href={`https://wa.me/${shop.whatsapp_number}`} icon={MessageCircle} label="WhatsApp" value="Send a message" external />}
                {shop.owner_phone && <ContactRow href={`tel:${shop.owner_phone}`} icon={Phone} label="Call" value={shop.owner_phone} />}
                {shop.owner_email && <ContactRow href={`mailto:${shop.owner_email}`} icon={Mail} label="Email" value={shop.owner_email} />}
                {shop.community_link && <ContactRow href={shop.community_link} icon={Users} label="Community" value="Join for deals and notices" external />}
            </div>

            <div className="mt-10 flex items-center gap-3">
                <span className="neu-inset flex h-10 w-10 items-center justify-center rounded-full"><BookOpen className="h-4 w-4" aria-hidden="true" /></span>
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Terms of buying here</h2>
            </div>
            <div className="neu-inset mt-4 rounded-2xl p-5">
                <TermsSectionsLive className="space-y-6" brandName={shop.shop_name} />
            </div>

            <CopyrightFooter variant="shop" shopName={shop.shop_name} adminSettings={settingsMap} className="pt-10" />
        </StorefrontPageFrame>
    )
}
