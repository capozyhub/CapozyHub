'use client'

import Link from 'next/link'
import { MessageCircle, Radio, Users2 } from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand'
import { cn } from '@/lib/utils'
import { DEVELOPER_PRODUCTS } from '@/lib/developer-products'
import { BRAND } from '@/lib/brand'

interface FooterLink {
    label: string
    href: string
}

const PRODUCT_LINKS: FooterLink[] = [
    { label: 'Data bundles', href: '/#products' },
    { label: 'Airtime', href: '/#products' },
    { label: 'AFA registration', href: '/#afa' },
    { label: 'Developer API', href: '/developers' },
]

const COMPANY_LINKS: FooterLink[] = [
    { label: 'How it works', href: '/#how' },
    { label: 'Open a shop', href: '/#resell' },
    { label: 'Sub-agents', href: '/dashboard/recruit' },
]

const LEGAL_LINKS: FooterLink[] = [
    { label: 'Terms of service', href: '/terms' },
    { label: 'Privacy policy', href: '/privacy' },
]

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'

function FooterColumnLink({ href, label }: FooterLink) {
    return (
        <Link href={href} className={cn('rounded text-sm text-silver-200 transition-colors hover:text-brand-400', FOCUS)}>
            {label}
        </Link>
    )
}

interface LandingFooterProps {
    adminSettings?: Record<string, string>
    whatsappHref: string
    adminPhone?: string
    whatsappGroupLink: string
    whatsappChannelLink: string
    className?: string
}

export function LandingFooter({
    adminSettings = {},
    whatsappHref,
    adminPhone,
    whatsappGroupLink,
    whatsappChannelLink,
    className,
}: LandingFooterProps) {
    const footerText = adminSettings?.footer_copyright_text || `${new Date().getFullYear()} ${BRAND.name}`
    const hasCommunity = !!(whatsappGroupLink || whatsappChannelLink)
    const hasContact = !!adminPhone

    const social = [
        hasContact && { href: whatsappHref, label: 'Chat with us on WhatsApp', Icon: MessageCircle },
        whatsappChannelLink && { href: whatsappChannelLink, label: 'Follow our WhatsApp channel', Icon: Radio },
        whatsappGroupLink && { href: whatsappGroupLink, label: 'Join our WhatsApp community group', Icon: Users2 },
    ].filter(Boolean) as { href: string; label: string; Icon: typeof Radio }[]

    return (
        <footer className={cn('relative mt-auto bg-black text-white', className)}>
            <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
                <div className="grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-8">
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className={cn('flex w-fit items-center gap-2 rounded-full', FOCUS)}>
                            <BrandLogo width={36} height={36} className="h-9 w-9" />
                            <span className="font-display text-xl font-bold tracking-tight">
                                {BRAND.nameFirst} <span className="text-brand-500">{BRAND.nameSecond}</span>
                            </span>
                        </Link>
                        <p className="mt-4 max-w-xs text-sm leading-relaxed text-silver-200">
                            Data, airtime, result checkers and AFA from one wallet, with the tools to resell them.
                        </p>
                        {(hasContact || hasCommunity) && social.length > 0 && (
                            <div className="mt-5 flex items-center gap-3">
                                {social.map(({ href, label, Icon }) => (
                                    <a
                                        key={label}
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={label}
                                        className={cn('neu-night flex h-11 w-11 items-center justify-center rounded-full text-silver-100 transition-colors hover:text-[#25D366]', FOCUS)}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {[
                        { heading: 'Products', links: PRODUCT_LINKS },
                        { heading: 'Company', links: COMPANY_LINKS },
                        { heading: 'Legal', links: LEGAL_LINKS },
                    ].map((col) => (
                        <div key={col.heading}>
                            <h4 className="font-display text-base font-semibold text-white">{col.heading}</h4>
                            <ul className="mt-4 space-y-3">
                                {col.links.map((link) => (
                                    <li key={link.label}><FooterColumnLink {...link} /></li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="neu-night-in mt-12 rounded-2xl p-5 sm:p-6">
                    <h4 className="font-display text-base font-semibold text-white">Developer API</h4>
                    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                        {DEVELOPER_PRODUCTS.map((p) => (
                            <li key={p.slug}>
                                <FooterColumnLink href={`/developers/${p.slug}`} label={p.name} />
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="mt-10 text-xs text-silver-200/80">
                    © {footerText}. All rights reserved.
                </p>
            </div>
        </footer>
    )
}
