'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, BellPlus, Mail, MessageCircle, Phone, ShoppingBag, Users, type LucideIcon } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { cn } from '@/lib/utils'

const FOCUS_ON_DARK =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'

export interface StorefrontLink {
    href: string
    label: string
    icon: LucideIcon
}

export interface StorefrontShellProps {
    name: string
    description?: string | null
    logoUrl?: string | null
    /** Already contrast-checked by resolveAccent(). */
    accent: string
    links: StorefrontLink[]
    phone?: string | null
    email?: string | null
    whatsapp?: string | null
    community?: string | null
    /** 'hidden' when the browser can't do push. */
    notify: 'hidden' | 'idle' | 'on'
    onNotify: () => void
    announcement?: { unread: boolean; onOpen: () => void } | null
    /** Rendered in the sheet header, e.g. the theme toggle. */
    headerAction?: React.ReactNode
    children: React.ReactNode
}

/**
 * Frame for the public storefront. A black stage carries the shop's identity and a gold
 * swoosh; the light sheet beside it (on mobile, rising over it) holds everything you can buy.
 */
export function StorefrontShell({
    name, description, logoUrl, accent, links, phone, email, whatsapp, community,
    notify, onNotify, announcement, headerAction, children,
}: StorefrontShellProps) {
    const pill = cn('neu-night inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition-colors hover:text-brand-400', FOCUS_ON_DARK)

    return (
        <div
            className="flex min-h-[100dvh] flex-col bg-black lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:bg-neu"
            style={{ ['--shop-accent' as string]: accent }}
        >
            <aside className="relative isolate overflow-hidden bg-black px-6 pb-24 pt-8 text-white sm:px-10 sm:pb-28 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:justify-between lg:p-12 lg:pb-12 xl:p-16">
                <BrandSwoosh className="pointer-events-none absolute -bottom-6 -right-[30%] -z-10 w-full opacity-90 sm:-right-[10%] sm:w-[70%] lg:-bottom-12 lg:-right-[24%] lg:w-[125%]" />

                <div className="flex items-center gap-4">
                    {logoUrl ? (
                        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-offset-2 ring-offset-black sm:h-20 sm:w-20" style={{ ['--tw-ring-color' as string]: accent }}>
                            <Image src={logoUrl} alt="" fill sizes="80px" priority className="object-cover" />
                        </span>
                    ) : (
                        <span className="neu-night flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-black sm:h-20 sm:w-20" style={{ ['--tw-ring-color' as string]: accent }}>
                            <ShoppingBag className="h-7 w-7 text-brand-400" aria-hidden="true" />
                        </span>
                    )}
                </div>

                <div className="mt-8 max-w-md lg:mt-0">
                    <h1 className="font-display text-[2.1rem] font-bold leading-[1.02] tracking-tight text-white text-balance sm:text-5xl xl:text-6xl">
                        {name}
                    </h1>
                    <span aria-hidden="true" className="mt-4 block h-1 w-14 rounded-full" style={{ backgroundColor: accent }} />
                    {description && (
                        <p className="mt-4 line-clamp-3 text-base leading-relaxed text-silver-200 sm:text-lg">{description}</p>
                    )}

                    <div className="mt-6 flex flex-wrap gap-2.5">
                        {whatsapp && (
                            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className={cn('clay-gold inline-flex min-h-[2.75rem] items-center gap-2 rounded-full px-4 text-sm font-semibold', FOCUS_ON_DARK)}>
                                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Chat with us
                            </a>
                        )}
                        {phone && (
                            <a href={`tel:${phone}`} className={pill}><Phone className="h-4 w-4" aria-hidden="true" /> {phone}</a>
                        )}
                        {email && (
                            <a href={`mailto:${email}`} className={pill}><Mail className="h-4 w-4" aria-hidden="true" /> Email</a>
                        )}
                        {community && (
                            <a href={community} target="_blank" rel="noopener noreferrer" className={pill}><Users className="h-4 w-4" aria-hidden="true" /> Community</a>
                        )}
                    </div>
                </div>

                <nav aria-label="Shop pages" className="mt-8 hidden flex-col gap-1 text-sm lg:flex">
                    {links.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href} className={cn('flex w-fit items-center gap-2 rounded-full py-1.5 text-silver-200 transition-colors hover:text-white', FOCUS_ON_DARK)}>
                            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                        </Link>
                    ))}
                    {notify !== 'hidden' && (
                        <button type="button" onClick={onNotify} disabled={notify === 'on'} className={cn('flex w-fit items-center gap-2 rounded-full py-1.5 text-silver-200 transition-colors hover:text-white disabled:text-brand-400', FOCUS_ON_DARK)}>
                            {notify === 'on' ? <><Bell className="h-4 w-4" aria-hidden="true" /> Order alerts are on</> : <><BellPlus className="h-4 w-4" aria-hidden="true" /> Get order alerts</>}
                        </button>
                    )}
                </nav>
            </aside>

            <main className="relative -mt-8 flex flex-1 flex-col rounded-t-[2rem] bg-neu px-5 pb-16 pt-6 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10 lg:mt-0 lg:min-h-[100dvh] lg:rounded-none lg:px-12 lg:shadow-none xl:px-16">
                <div className="mx-auto w-full max-w-[34rem]">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">What do you need today?</h2>
                        {headerAction}
                    </div>

                    {announcement && (
                        <button
                            type="button"
                            onClick={announcement.onOpen}
                            className="neu-raised-sm neu-press mb-5 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500"
                        >
                            <span className="clay-gold relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                                <Bell className="h-4 w-4" aria-hidden="true" />
                                {announcement.unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[var(--neu-bg)]" />}
                            </span>
                            <span className="flex-1">{announcement.unread ? 'A new notice from this shop' : 'Read the latest notice'}</span>
                        </button>
                    )}

                    {children}

                    <nav aria-label="Shop pages" className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-foreground/10 pt-5 text-sm lg:hidden">
                        {links.map(({ href, label, icon: Icon }) => (
                            <Link key={href} href={href} className="flex items-center gap-1.5 rounded font-semibold text-muted-foreground hover:text-foreground">
                                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                            </Link>
                        ))}
                        {notify !== 'hidden' && (
                            <button type="button" onClick={onNotify} disabled={notify === 'on'} className="flex items-center gap-1.5 rounded font-semibold text-muted-foreground hover:text-foreground disabled:opacity-70">
                                {notify === 'on' ? <><Bell className="h-4 w-4" aria-hidden="true" /> Order alerts are on</> : <><BellPlus className="h-4 w-4" aria-hidden="true" /> Get order alerts</>}
                            </button>
                        )}
                    </nav>
                </div>
            </main>
        </div>
    )
}
