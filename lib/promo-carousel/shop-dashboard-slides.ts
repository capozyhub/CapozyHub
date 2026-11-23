// lib/promo-carousel/shop-dashboard-slides.ts
import {
    Tag, FileText, Settings, Banknote, Share2,
} from 'lucide-react'
import type { PromoSlide } from './types'

export interface ShopDashboardSlideContext {
    shopIsLive: boolean
    brandColor: string
}

export function buildShopDashboardSlides(ctx: ShopDashboardSlideContext): PromoSlide[] {
    const slides: PromoSlide[] = []
    const accentColor = ctx.brandColor

    if (!ctx.shopIsLive) {
        slides.push({
            id: 'setup-pricing',
            theme: 'amber',
            eyebrowIcon: Tag,
            eyebrow: 'GET LIVE',
            title: 'Set up your pricing to go live!',
            body: 'Submit your pricing for approval and your storefront link goes live for customers.',
            icon: Tag,
            cta: { label: 'Set Up Pricing', href: '/dashboard/shop/pricing' },
            accentColor,
        })
    }

    if (ctx.shopIsLive) {
        slides.push(
            {
                id: 'profit-logs',
                theme: 'violet',
                eyebrowIcon: FileText,
                eyebrow: 'EARNINGS',
                title: 'Profit Logs',
                body: 'See exactly how much you made on every single sale.',
                icon: FileText,
                cta: { label: 'View Logs', href: '/dashboard/shop/profit-logs' },
                accentColor,
            },
            {
                id: 'pricing',
                theme: 'amber',
                eyebrowIcon: Tag,
                eyebrow: 'PRICING',
                title: 'Review your pricing',
                body: 'Keep your margins healthy — update your selling prices any time.',
                icon: Tag,
                cta: { label: 'Edit Pricing', href: '/dashboard/shop/pricing' },
                accentColor,
            },
            {
                id: 'shop-settings',
                theme: 'blue',
                eyebrowIcon: Settings,
                eyebrow: 'SETTINGS',
                title: 'Edit your shop',
                body: 'Update your shop name, logo, description and brand color any time.',
                icon: Settings,
                cta: { label: 'Edit Shop', href: '/dashboard/shop/setup' },
                accentColor,
            },
            {
                id: 'withdraw-earnings',
                theme: 'emerald',
                eyebrowIcon: Banknote,
                eyebrow: 'WITHDRAW',
                title: 'Withdraw your earnings',
                body: 'Move your shop profit to your wallet or Mobile Money any time.',
                icon: Banknote,
                cta: { label: 'Withdraw', href: '/dashboard/shop/withdraw' },
                accentColor,
            },
        )
    }

    // Grow Your Shop tips — lifted verbatim from app/dashboard/shop/customers/page.tsx:241-244
    slides.push(
        {
            id: 'tip-whatsapp-status',
            theme: 'rose',
            eyebrowIcon: Share2,
            eyebrow: 'GROW',
            title: 'Post on WhatsApp Status',
            body: 'Post your shop link on WhatsApp status daily — consistency beats one big push.',
            icon: Share2,
            cta: { label: 'Grow My Shop', href: '/dashboard/shop/customers' },
            accentColor,
        },
        {
            id: 'tip-qr-code',
            theme: 'amber',
            eyebrowIcon: Share2,
            eyebrow: 'GROW',
            title: 'Print your QR code',
            body: 'Print the QR code and place it where your community gathers.',
            icon: Share2,
            cta: { label: 'Grow My Shop', href: '/dashboard/shop/customers' },
            accentColor,
        },
        {
            id: 'tip-reward-returning',
            theme: 'emerald',
            eyebrowIcon: Share2,
            eyebrow: 'GROW',
            title: 'Reward returning customers',
            body: 'Reward returning customers with a small discount on bulk orders.',
            icon: Share2,
            cta: { label: 'Grow My Shop', href: '/dashboard/shop/customers' },
            accentColor,
        },
    )

    return slides
}
