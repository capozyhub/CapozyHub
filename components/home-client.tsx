'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Menu, Quote, Star, X } from 'lucide-react'
import { LandingFooter } from '@/components/landing-footer'
import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'
import { NetworkIcon } from '@/components/network-icon'
import { BrandLogo } from '@/components/ui/brand'
import { DEVELOPER_PRODUCTS } from '@/lib/developer-products'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

const PWAInstallPrompt = dynamic(() => import('@/components/pwa-install-prompt').then(m => ({ default: m.PWAInstallPrompt })), { ssr: false })
const PWAInstallButton = dynamic(() => import('@/components/pwa-install-prompt').then(m => ({ default: m.PWAInstallButton })), { ssr: false })

interface LandingDataPackage {
    network: string
    volume: string
    price: string
}

interface LandingAgentPlan {
    key: string
    title: string
    duration: string
    price: string
    oldPrice?: string
    badge?: string
}

interface LandingReview {
    name: string
    role: string
    rating: number
    quote: string
}

interface FaqItem {
    question: string
    answer: React.ReactNode
}

type PackagesByNetwork = Record<string, LandingDataPackage[]>

// Nothing below is invented marketing: a brand-new business has no customer count,
// no reviews and no published agent prices yet. Each of these is empty until an admin
// sets real values (Admin > Settings > Landing Page), and the matching section hides itself.
const DEFAULT_GUEST_URL = ''
const DEFAULT_CUSTOMER_COUNT_LABEL = ''
const DEFAULT_CUSTOMER_COUNT_TARGET = 0
const DEFAULT_AGENT_PLANS: LandingAgentPlan[] = []
const DEFAULT_TESTIMONIALS: LandingReview[] = []

const POPULAR_NETWORK_ORDER = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'AT']

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'
const FOCUS_ON_DARK = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
const WRAP = 'mx-auto w-full max-w-6xl px-5 sm:px-8'

// Soft surfaces that must stay light even inside the black sections (the shop preview).
const LIGHT_OUT = 'bg-[#E8E8E8] shadow-[6px_6px_12px_#B5B5B5,-6px_-6px_12px_#FFFFFF]'
const LIGHT_IN = 'bg-[#E8E8E8] shadow-[inset_3px_3px_6px_#C2C2C2,inset_-3px_-3px_6px_#FFFFFF]'

const linkClass = 'font-semibold underline underline-offset-4 decoration-brand-600 hover:decoration-2 text-brand-800 dark:text-brand-400'

const getFaqItems = (guestUrl: string): FaqItem[] => [
    {
        question: 'How do I buy data or airtime?',
        answer: (
            <span>
                Create an account, fund your wallet, then pick a bundle or an airtime amount and enter the recipient&apos;s number.
                The order is placed straight from your wallet and sent to that number without any manual step.
            </span>
        ),
    },
    ...(guestUrl ? [{
        question: 'Can I buy without an account?',
        answer: (
            <span>
                Yes. For a one-off purchase, use the <a href={guestUrl} className={linkClass}>guest store</a> and pay with MoMo or card. You will not get a wallet, order history or reseller prices there.
            </span>
        ),
    }] : []),
    {
        question: 'How does the wallet work?',
        answer: (
            <span>
                Your wallet is a balance you hold on {BRAND.name}. Top it up once with MoMo or a card, then every purchase draws from it, so you never re-enter payment details. Every top-up and spend shows in your transaction history.
            </span>
        ),
    },
    {
        question: 'What does it cost to sign up?',
        answer: (
            <span>
                Nothing. Sign up with your name, email and a password, and you land in your dashboard. You only pay when you buy.
            </span>
        ),
    },
    {
        question: 'Can I run my own shop?',
        answer: (
            <span>
                Yes. Open a shop from your dashboard, add your logo, set your own price on top of ours, and share the link. When someone buys from it, the difference is your profit.
            </span>
        ),
    },
    {
        question: 'How do I connect my own app?',
        answer: (
            <span>
                The developer API lets your website or app place the same orders you place by hand. Read the <Link href="/developers" className={linkClass}>documentation</Link>, then create a key from the developer section of your dashboard.
            </span>
        ),
    },
    {
        question: 'What if an order is late or fails?',
        answer: (
            <span>
                Open the order in your dashboard and tap <strong>Report issue</strong>. The complaint is tracked against that order and you see each update there.
            </span>
        ),
    },
]

type ProductKey = 'data' | 'airtime' | 'checker' | 'afa'

const PICKER: { key: ProductKey; label: string; options: string[]; note: string }[] = [
    { key: 'data', label: 'Data', options: ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'], note: 'Choose a bundle size inside your dashboard.' },
    { key: 'airtime', label: 'Airtime', options: ['MTN', 'Telecel', 'AT'], note: 'Any amount, sent to any number on the network.' },
    { key: 'checker', label: 'Checkers', options: ['BECE', 'WASSCE'], note: 'The voucher and PIN arrive in your order history.' },
    { key: 'afa', label: 'AFA', options: ['MTN'], note: 'Register and renew from your wallet.' },
]

const NETWORK_ICON_NAMES = ['MTN', 'Telecel', 'AT', 'AT-iShare', 'AT-BigTime']

const BUY_LIST = [
    { title: 'Data bundles', text: 'MTN, Telecel and AirtelTigo bundles at reseller rates.', href: '/dashboard/data-packages' },
    { title: 'Airtime', text: 'Top up any line from your wallet balance.', href: '/dashboard/airtime' },
    { title: 'MTN Mashup', text: 'Voice and data combos, activated on the line you choose.', href: '/dashboard/data-packages' },
    { title: 'Result checkers', text: 'BECE and WASSCE vouchers, ready to use.', href: '/dashboard/results-checker' },
    { title: 'AFA registration', text: 'Register and renew without visiting an office.', href: '/dashboard/upgrade' },
    { title: 'Send and claim', text: 'Move wallet balance to another user with a claim link.', href: '/dashboard/wallet' },
]

const SELL_LIST = [
    { title: 'Your own shop', text: 'A branded storefront with your logo and your prices.', href: '/dashboard/shop' },
    { title: 'Sub-agents', text: 'Bring in people to sell for you and earn from what they sell.', href: '/dashboard/recruit' },
    { title: 'Developer API', text: 'Let your own site or app place orders for you.', href: '/developers' },
]

const STEPS = [
    { title: 'Create your account', text: 'A name, an email and a password. That is all we ask for.' },
    { title: 'Fund your wallet', text: 'Top up with MoMo or a card. Your balance waits until you spend it.' },
    { title: 'Buy, or start selling', text: 'Place an order for yourself, or share your shop link and let customers buy at your margin.' },
]

function parseCustomerCountTarget(rawCount: string): number {
    const digitsOnly = rawCount.replace(/[^\d]/g, '')
    if (!digitsOnly) return DEFAULT_CUSTOMER_COUNT_TARGET
    const parsed = parseInt(digitsOnly, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CUSTOMER_COUNT_TARGET
    // M-4: Hard cap at 10 million to prevent render loops even if DB is poisoned
    return Math.min(parsed, 10_000_000)
}

/**
 * The one memorable element: an inflated clay crescent drawn from the sweep in the logo.
 * Layers: silver echo, gold body, a soft shadow along the lower edge and a blurred highlight along the top.
 */
function Swoosh({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 1200 700" className={className} aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id="swoosh-gold" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0" stopColor="#F6A900" />
                    <stop offset="0.55" stopColor="#F6C30F" />
                    <stop offset="1" stopColor="#FEE21C" />
                </linearGradient>
                <linearGradient id="swoosh-silver" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0" stopColor="#C2C2C2" stopOpacity="0" />
                    <stop offset="0.6" stopColor="#E8E8E8" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#F9F9F9" stopOpacity="0.8" />
                </linearGradient>
                <filter id="swoosh-soft" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur stdDeviation="9" />
                </filter>
                <clipPath id="swoosh-clip">
                    <path d="M-20 560 C 250 600 540 430 720 210 C 820 90 960 20 1220 0 C 1000 70 900 160 820 270 C 620 540 300 660 -20 620 Z" />
                </clipPath>
            </defs>
            <path
                fill="url(#swoosh-silver)"
                d="M-20 650 C 270 690 580 540 780 320 C 880 210 1010 130 1220 130 C 1050 180 950 262 862 372 C 660 622 340 750 -20 710 Z"
            />
            <path
                fill="url(#swoosh-gold)"
                d="M-20 560 C 250 600 540 430 720 210 C 820 90 960 20 1220 0 C 1000 70 900 160 820 270 C 620 540 300 660 -20 620 Z"
            />
            <g clipPath="url(#swoosh-clip)">
                <path
                    d="M-20 640 C 300 690 600 520 800 280 C 900 170 1020 90 1230 70"
                    className="swoosh-fx" fill="none" stroke="#8A5600" strokeOpacity="0.55" strokeWidth="26" filter="url(#swoosh-soft)"
                />
                <path
                    d="M-20 566 C 250 606 545 436 726 214 C 826 94 964 26 1220 6"
                    className="swoosh-fx" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="10" strokeLinecap="round" filter="url(#swoosh-soft)"
                />
            </g>
        </svg>
    )
}

function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <h2 className={cn('font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] text-foreground text-balance', className)}>
            {children}
        </h2>
    )
}

export default function HomeClient({
    guestUrl = DEFAULT_GUEST_URL,
    adminPhone = '',
    landingCustomerCountRaw = DEFAULT_CUSTOMER_COUNT_LABEL,
    landingDataPackagesByNetwork = {},
    showPopularPackages = false,
    landingAgentPlans = DEFAULT_AGENT_PLANS,
    landingTestimonials = DEFAULT_TESTIMONIALS,
    adminSettings = {},
    whatsappGroupLink = '',
    whatsappChannelLink = '',
    whatsappCommunityLink = '',
}: {
    guestUrl?: string
    adminPhone?: string
    landingCustomerCountRaw?: string
    landingDataPackagesByNetwork?: PackagesByNetwork
    showPopularPackages?: boolean
    landingAgentPlans?: LandingAgentPlan[]
    landingTestimonials?: LandingReview[]
    adminSettings?: Record<string, string>
    whatsappGroupLink?: string
    whatsappChannelLink?: string
    whatsappCommunityLink?: string
}) {
    const router = useRouter()
    const [menuOpen, setMenuOpen] = useState(false)
    const [navSolid, setNavSolid] = useState(false)
    const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(0)
    const [countTarget, setCountTarget] = useState(DEFAULT_CUSTOMER_COUNT_TARGET)
    const [product, setProduct] = useState<ProductKey>('data')
    const [option, setOption] = useState<string>('MTN')
    const [packageNetwork, setPackageNetwork] = useState<string | null>(null)

    const whatsappHref = adminPhone ? `https://wa.me/${adminPhone}` : '#community'
    // Contact / community entry points only render when a real destination is configured.
    const hasContact = !!adminPhone
    const hasCommunity = !!(whatsappGroupLink || whatsappChannelLink || whatsappCommunityLink)

    const groupedPackageEntries = useMemo(() => {
        const entries = Object.entries(landingDataPackagesByNetwork)
        return entries.sort((a, b) => {
            const indexA = POPULAR_NETWORK_ORDER.indexOf(a[0])
            const indexB = POPULAR_NETWORK_ORDER.indexOf(b[0])
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
        })
    }, [landingDataPackagesByNetwork])

    const activePackageNetwork = packageNetwork && landingDataPackagesByNetwork[packageNetwork]
        ? packageNetwork
        : groupedPackageEntries[0]?.[0] ?? null

    const picker = PICKER.find(p => p.key === product) ?? PICKER[0]
    // Real prices only: shown when an admin has published packages for the chosen network.
    const pickerPackages = product === 'data' ? (landingDataPackagesByNetwork[option] ?? []).slice(0, 6) : []

    useEffect(() => {
        const onScroll = () => setNavSolid(window.scrollY > 24)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    useEffect(() => {
        try {
            const slug = sessionStorage.getItem('shop_sticky_slug')
            if (slug) router.replace(`/shop/${slug}`)
        } catch {
            // ignore storage access errors
        }
    }, [router])

    // The installed app opens on /auth because the manifest's start_url is /auth, so this
    // page never redirects: the landing page stays reachable from inside the app.

    useEffect(() => {
        setCountTarget(parseCustomerCountTarget(landingCustomerCountRaw))
    }, [landingCustomerCountRaw])

    const selectProduct = (key: ProductKey) => {
        setProduct(key)
        const next = PICKER.find(p => p.key === key)
        if (next) setOption(next.options[0])
    }

    const navLinks = [
        { label: 'Products', href: '#products' },
        { label: 'How it works', href: '#how' },
        { label: 'Sell', href: '#resell' },
        { label: 'AFA', href: '#afa' },
        { label: 'Developers', href: '/developers' },
        ...(hasCommunity ? [{ label: 'Community', href: '#community' }] : []),
    ]

    return (
        <div className="min-h-screen bg-neu text-foreground overflow-x-clip">
            <PWAInstallPrompt />

            {/* Navigation: a floating bar that stays dark over the black hero and the light page */}
            <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
                <nav
                    aria-label="Main"
                    className={cn(
                        'mx-auto max-w-6xl rounded-[1.75rem] text-white transition-colors duration-300 shadow-[0_14px_34px_rgba(0,0,0,0.5),inset_1px_1px_0_rgba(255,255,255,0.08),inset_-1px_-1px_0_rgba(0,0,0,0.6)]',
                        navSolid || menuOpen ? 'bg-[#0b0b0b]/95' : 'bg-[#0b0b0b]/80'
                    )}
                >
                    <div className="flex h-14 items-center justify-between gap-3 pl-3 pr-2 sm:pl-4">
                        <Link href="/" className={cn('flex items-center gap-2 rounded-full', FOCUS_ON_DARK)} onClick={() => setMenuOpen(false)}>
                            <BrandLogo width={32} height={32} className="h-8 w-8" />
                            <span className="font-display text-lg font-bold tracking-tight text-white">
                                {BRAND.nameFirst} <span className="text-brand-500">{BRAND.nameSecond}</span>
                            </span>
                        </Link>

                        <div className="hidden lg:flex items-center gap-1">
                            {navLinks.map((l) => {
                                const cls = cn('rounded-full px-3 py-2 text-sm font-medium text-silver-200 transition-colors hover:text-white', FOCUS_ON_DARK)
                                return l.href.startsWith('/')
                                    ? <Link key={l.label} href={l.href} className={cls}>{l.label}</Link>
                                    : <a key={l.label} href={l.href} className={cls}>{l.label}</a>
                            })}
                        </div>

                        <div className="flex items-center gap-1.5">
                            <div className="hidden xl:block"><PWAInstallButton /></div>
                            <Link href="/auth" className={cn('hidden sm:inline-flex rounded-full px-4 py-2 text-sm font-semibold text-white hover:bg-white/10', FOCUS_ON_DARK)}>
                                Sign in
                            </Link>
                            <Link href="/auth?tab=signup" className={cn('clay-gold inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold', FOCUS_ON_DARK)}>
                                Get started
                            </Link>
                            <button
                                type="button"
                                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                                aria-expanded={menuOpen}
                                aria-controls="mobile-menu"
                                onClick={() => setMenuOpen(o => !o)}
                                className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10 lg:hidden', FOCUS_ON_DARK)}
                            >
                                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    {menuOpen && (
                        <div id="mobile-menu" className="border-t border-white/10 px-3 pb-3 pt-2 lg:hidden">
                            <ul className="flex flex-col">
                                {navLinks.map((l) => (
                                    <li key={l.label}>
                                        {l.href.startsWith('/')
                                            ? <Link href={l.href} onClick={() => setMenuOpen(false)} className={cn('block rounded-xl px-3 py-3 text-base font-medium text-silver-100 hover:bg-white/10', FOCUS_ON_DARK)}>{l.label}</Link>
                                            : <a href={l.href} onClick={() => setMenuOpen(false)} className={cn('block rounded-xl px-3 py-3 text-base font-medium text-silver-100 hover:bg-white/10', FOCUS_ON_DARK)}>{l.label}</a>}
                                    </li>
                                ))}
                                <li className="sm:hidden">
                                    <Link href="/auth" onClick={() => setMenuOpen(false)} className={cn('block rounded-xl px-3 py-3 text-base font-medium text-silver-100 hover:bg-white/10', FOCUS_ON_DARK)}>Sign in</Link>
                                </li>
                            </ul>
                        </div>
                    )}
                </nav>
            </header>

            <main>
                {/* Hero */}
                <section className="relative isolate overflow-hidden bg-black text-white">
                    <div className="swoosh-reveal pointer-events-none absolute [mask-image:linear-gradient(to_right,transparent,black_30%)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_30%)] bottom-0 right-0 -z-10 w-[170%] translate-x-[22%] sm:w-[120%] sm:translate-x-[12%] lg:w-[78%] lg:translate-x-[4%]" aria-hidden="true">
                        <Swoosh className="h-auto w-full" />
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black to-transparent" aria-hidden="true" />

                    <div className={cn(WRAP, 'grid gap-12 pb-16 pt-32 sm:pb-24 sm:pt-40 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pb-32')}>
                        <div className="lg:col-span-7">
                            <h1 className="font-display text-[2.6rem] font-bold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-[3.6rem] xl:text-[4.5rem] text-balance">
                                Top up in seconds. Resell at your own margin.
                            </h1>
                            <p className="mt-6 max-w-xl text-lg leading-relaxed text-silver-200 sm:text-xl">
                                One wallet for data, airtime, exam result checkers and AFA, across MTN, Telecel and AirtelTigo. Buy for yourself, or open a shop and sell to everyone you know.
                            </p>

                            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                                <Link href="/auth?tab=signup" className={cn('clay-gold inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-full px-8 text-base font-semibold', FOCUS_ON_DARK)}>
                                    Create your account
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link href="/auth" className={cn('neu-night inline-flex min-h-[3.5rem] items-center justify-center rounded-full px-8 text-base font-semibold text-white transition-colors hover:text-brand-400', FOCUS_ON_DARK)}>
                                    Sign in
                                </Link>
                            </div>
                            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-silver-200">
                                {guestUrl && (
                                    <a href={guestUrl} className={cn('rounded underline underline-offset-4 decoration-white/30 hover:decoration-brand-500 hover:text-white', FOCUS_ON_DARK)}>
                                        Just need one bundle? Use the guest store
                                    </a>
                                )}
                                <Link href="/download" className={cn('rounded underline underline-offset-4 decoration-white/30 hover:decoration-brand-500 hover:text-white', FOCUS_ON_DARK)}>
                                    Get the app
                                </Link>
                            </div>

                            <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
                                <div className="flex items-center gap-3">
                                    {['MTN', 'Telecel', 'AT'].map((n) => (
                                        <span key={n} className="neu-night flex h-12 w-12 items-center justify-center rounded-full">
                                            <NetworkIcon network={n} size={30} />
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-silver-200">
                                    {landingCustomerCountRaw
                                        ? <>Trusted by <span className="font-semibold text-white tabular-nums">{landingCustomerCountRaw}</span> customers across Ghana</>
                                        : 'All three networks, one balance'}
                                </p>
                            </div>
                        </div>

                        {/* Product picker */}
                        <div className="lg:col-span-5">
                            <div className="neu-night rounded-[2rem] p-5 sm:p-7">
                                <p className="font-display text-xl font-semibold text-white">What do you need today?</p>

                                <div role="tablist" aria-label="Product" className="neu-night-in mt-4 grid grid-cols-4 gap-1.5 rounded-2xl p-1.5">
                                    {PICKER.map((p) => (
                                        <button
                                            key={p.key}
                                            role="tab"
                                            type="button"
                                            aria-selected={product === p.key}
                                            onClick={() => selectProduct(p.key)}
                                            className={cn(
                                                'rounded-xl px-1 py-2.5 text-[13px] font-semibold leading-tight sm:text-sm',
                                                product === p.key ? 'clay-gold' : 'text-silver-100 transition-colors hover:text-white',
                                                FOCUS_ON_DARK
                                            )}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-5 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Network">
                                    {picker.options.map((o) => (
                                        <button
                                            key={o}
                                            type="button"
                                            role="radio"
                                            aria-checked={option === o}
                                            onClick={() => setOption(o)}
                                            className={cn(
                                                'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-shadow',
                                                option === o ? 'neu-night-in text-brand-400 ring-1 ring-brand-500/70' : 'neu-night text-silver-100 hover:text-white',
                                                FOCUS_ON_DARK
                                            )}
                                        >
                                            {NETWORK_ICON_NAMES.includes(o) && <NetworkIcon network={o} size={20} />}
                                            {o}
                                        </button>
                                    ))}
                                </div>

                                <div className="neu-night-in mt-5 min-h-[7.5rem] rounded-2xl p-4">
                                    {pickerPackages.length > 0 ? (
                                        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                                            {pickerPackages.map((pkg, i) => (
                                                <li key={`${pkg.volume}-${pkg.price}-${i}`} className="neu-night rounded-xl px-3 py-2.5">
                                                    <p className="font-display text-lg font-semibold leading-none text-white">{pkg.volume}</p>
                                                    <p className="mt-1 text-sm tabular-nums text-brand-400">GHS {pkg.price}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm leading-relaxed text-silver-200">
                                            {picker.note} Live prices show once you are signed in, so what you see is what you pay.
                                        </p>
                                    )}
                                </div>

                                <Link href="/auth?tab=signup" className={cn('clay-silver mt-5 flex min-h-[3.5rem] items-center justify-between rounded-2xl px-5 text-base font-semibold', FOCUS_ON_DARK)}>
                                    <span>Continue with {option} {picker.label.toLowerCase()}</span>
                                    <ArrowRight className="h-5 w-5 shrink-0" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Products: soft rows pressed out of the canvas */}
                <section id="products" className="scroll-mt-24 py-20 sm:py-28">
                    <div className={WRAP}>
                        <SectionHeading className="max-w-3xl">
                            Everything you buy, and everything you sell, from one wallet.
                        </SectionHeading>

                        <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-14">
                            {[
                                { heading: 'Buy for yourself', items: BUY_LIST },
                                { heading: 'Sell to others', items: SELL_LIST },
                            ].map((group) => (
                                <div key={group.heading}>
                                    <h3 className="font-display text-2xl font-semibold text-foreground">{group.heading}</h3>
                                    <ul className="mt-6 space-y-4">
                                        {group.items.map((item) => (
                                            <li key={item.title}>
                                                <Link
                                                    href={item.href}
                                                    className={cn('neu-raised-sm neu-press group flex items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:px-6', FOCUS)}
                                                >
                                                    <span>
                                                        <span className="block font-display text-lg font-semibold text-foreground sm:text-xl">{item.title}</span>
                                                        <span className="mt-0.5 block max-w-md text-[15px] leading-relaxed text-muted-foreground">{item.text}</span>
                                                    </span>
                                                    <span className="clay-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                                                        <ArrowUpRight className="h-5 w-5" />
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How it works: a real sequence, so numbering is earned */}
                <section id="how" className="scroll-mt-24 py-20 sm:py-28">
                    <div className={WRAP}>
                        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
                            <div className="lg:col-span-4">
                                <SectionHeading>From sign-up to first order in three steps.</SectionHeading>
                            </div>
                            <ol className="space-y-6 lg:col-span-8">
                                {STEPS.map((s, i) => (
                                    <li key={s.title} className="neu-raised flex items-start gap-5 rounded-[1.75rem] p-5 sm:gap-6 sm:p-7">
                                        <span className="clay-gold flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold tabular-nums sm:h-16 sm:w-16 sm:text-3xl">{i + 1}</span>
                                        <div className="pt-1">
                                            <h3 className="font-display text-xl font-semibold text-foreground sm:text-2xl">{s.title}</h3>
                                            <p className="mt-2 max-w-lg text-base leading-relaxed text-muted-foreground">{s.text}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </section>

                {/* Sell: black band with a shop preview built from placeholders, not invented prices */}
                <section id="resell" className="scroll-mt-24 bg-black py-20 text-white sm:py-28">
                    <div className={cn(WRAP, 'grid items-center gap-12 lg:grid-cols-2 lg:gap-16')}>
                        <div>
                            <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-white text-balance sm:text-4xl lg:text-5xl">
                                Open a shop. Price it your way. Keep the difference.
                            </h2>
                            <p className="mt-5 max-w-lg text-lg leading-relaxed text-silver-200">
                                Your shop gets its own link, your logo and your colors. Customers pay you, we fulfil the order, and the margin you set lands in your earnings.
                            </p>
                            <ul className="mt-7 space-y-4">
                                {['Your own shop link to share anywhere', 'Set a different margin on every bundle', 'Track earnings and withdraw them'].map((t) => (
                                    <li key={t} className="flex items-center gap-3 text-silver-100">
                                        <span className="clay-gold flex h-7 w-7 shrink-0 items-center justify-center rounded-full"><Check className="h-4 w-4" /></span>
                                        <span>{t}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link href="/auth?tab=signup" className={cn('clay-gold mt-9 inline-flex min-h-[3.5rem] items-center gap-2 rounded-full px-8 text-base font-semibold', FOCUS_ON_DARK)}>
                                Open your shop
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        <div aria-hidden="true" className="neu-night rounded-[2rem] p-3 sm:p-4">
                            <div className="flex items-center gap-1.5 px-2 pb-3">
                                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                                <span className="neu-night-in ml-3 truncate rounded-full px-3 py-1 text-xs text-silver-200">yourshop.{BRAND.domain}</span>
                            </div>
                            <div className="overflow-hidden rounded-3xl bg-[#E8E8E8]">
                                <div className="flex items-center gap-3 bg-gradient-to-r from-brand-600 to-brand-300 p-4 sm:p-5">
                                    <div className="clay-black flex h-12 w-12 items-center justify-center rounded-2xl font-display text-lg font-bold text-brand-500">YS</div>
                                    <div>
                                        <p className="font-display text-lg font-bold leading-tight text-black">Your shop name</p>
                                        <p className="text-sm text-black/70">Your tagline goes here</p>
                                    </div>
                                </div>
                                <div className="space-y-3.5 p-4 sm:p-5">
                                    {['MTN', 'Telecel', 'AT'].map((n) => (
                                        <div key={n} className={cn('flex items-center justify-between rounded-2xl px-3 py-2.5', LIGHT_OUT)}>
                                            <div className="flex items-center gap-3">
                                                <NetworkIcon network={n} size={32} />
                                                <div className="space-y-1.5">
                                                    <div className={cn('h-2.5 w-14 rounded-full', LIGHT_IN)} />
                                                    <div className={cn('h-2 w-24 rounded-full', LIGHT_IN)} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={cn('h-2.5 w-12 rounded-full', LIGHT_IN)} />
                                                <div className="clay-gold rounded-full px-3.5 py-1.5 text-xs font-semibold">Buy</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AFA */}
                <section id="afa" className="scroll-mt-24 py-20 sm:py-28">
                    <div className={cn(WRAP, 'grid gap-10 lg:grid-cols-12 lg:gap-14')}>
                        <div className="lg:col-span-5">
                            <SectionHeading>Register for AFA without leaving your phone.</SectionHeading>
                        </div>
                        <div className="neu-raised rounded-[2rem] p-6 sm:p-9 lg:col-span-7">
                            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                                Submit your details from the dashboard, pay from your wallet and follow the application until it is approved. Agents keep their membership, and you can renew from the same place.
                            </p>
                            <ul className="mt-6 space-y-4">
                                {['Pay from your wallet, no separate checkout', 'Follow the status of every application', 'Renew from your dashboard'].map((t) => (
                                    <li key={t} className="flex items-center gap-3 text-foreground">
                                        <span className="clay-gold flex h-7 w-7 shrink-0 items-center justify-center rounded-full"><Check className="h-4 w-4" /></span>
                                        <span>{t}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link href="/auth?tab=signup" className={cn('clay-black mt-8 inline-flex min-h-[3.5rem] items-center gap-2 rounded-full px-8 text-base font-semibold', FOCUS)}>
                                Start your application
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Agent plans: only once an admin has published real plan prices */}
                {landingAgentPlans.length > 0 && (
                    <section className="py-20 sm:py-28">
                        <div className={WRAP}>
                            <SectionHeading className="max-w-3xl">Pick an agent plan and unlock wholesale prices.</SectionHeading>
                            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                                Every plan includes wholesale pricing, your own shop, bulk orders and developer API access.
                            </p>
                            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {landingAgentPlans.map((plan) => (
                                    <div key={plan.key} className={cn('flex flex-col rounded-[1.75rem] p-6', plan.badge ? 'clay-black' : 'neu-raised')}>
                                        {plan.badge && <p className="clay-gold mb-3 w-fit rounded-full px-3 py-1 text-xs font-semibold">{plan.badge}</p>}
                                        <h3 className={cn('font-display text-xl font-semibold', plan.badge ? 'text-white' : 'text-foreground')}>{plan.title}</h3>
                                        <p className={cn('mt-1 text-sm', plan.badge ? 'text-silver-200' : 'text-muted-foreground')}>{plan.duration}</p>
                                        <div className="mt-6">
                                            {plan.oldPrice && plan.oldPrice !== plan.price && (
                                                <p className="text-sm tabular-nums line-through opacity-60">GHS {plan.oldPrice}</p>
                                            )}
                                            <p className={cn('font-display text-4xl font-bold tabular-nums', plan.badge && 'text-brand-500')}>GHS {plan.price}</p>
                                        </div>
                                        <Link href="/auth?tab=signup" className={cn('mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-full text-sm font-semibold', plan.badge ? 'clay-gold' : 'clay-black', plan.badge ? FOCUS_ON_DARK : FOCUS)}>
                                            Choose {plan.title}
                                        </Link>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                                Lifetime Agents can go on to become Dealers, the top reseller rank on {BRAND.name}, with deeper discounts, higher API limits and priority support.
                            </p>
                        </div>
                    </section>
                )}

                {/* Published packages: only with real admin-set data */}
                {showPopularPackages && activePackageNetwork && (
                    <section className="py-20 sm:py-28">
                        <div className={WRAP}>
                            <SectionHeading className="max-w-3xl">Current bundle prices.</SectionHeading>
                            <div className="mt-8 flex flex-wrap gap-3" role="tablist" aria-label="Network">
                                {groupedPackageEntries.map(([network]) => (
                                    <button
                                        key={network}
                                        role="tab"
                                        type="button"
                                        aria-selected={activePackageNetwork === network}
                                        onClick={() => setPackageNetwork(network)}
                                        className={cn(
                                            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold',
                                            activePackageNetwork === network ? 'clay-gold' : 'neu-raised-sm neu-press text-foreground',
                                            activePackageNetwork === network ? FOCUS_ON_DARK : FOCUS
                                        )}
                                    >
                                        <NetworkIcon network={network} size={20} />
                                        {network}
                                    </button>
                                ))}
                            </div>
                            <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                                {(landingDataPackagesByNetwork[activePackageNetwork] ?? []).map((pkg, index) => (
                                    <li key={`${activePackageNetwork}-${pkg.volume}-${pkg.price}-${index}`} className="neu-raised-sm rounded-2xl p-4">
                                        <p className="font-display text-2xl font-bold text-foreground">{pkg.volume}</p>
                                        <p className="mt-1 text-sm tabular-nums text-muted-foreground">from <span className="font-semibold text-foreground">GHS {pkg.price}</span></p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                )}

                {/* Customer count: only with a real, admin-set number */}
                {landingCustomerCountRaw && countTarget > 0 && (
                    <section className="py-10 sm:py-14">
                        <div className={WRAP}>
                            <div className="clay-gold flex flex-col gap-3 rounded-[2.5rem] px-7 py-10 sm:flex-row sm:items-baseline sm:gap-8 sm:px-12">
                                <p className="font-display text-6xl font-bold leading-none tabular-nums sm:text-7xl">
                                    {countTarget.toLocaleString()}{landingCustomerCountRaw.includes('+') ? '+' : ''}
                                </p>
                                <p className="max-w-md text-lg font-medium">customers across Ghana already buy and sell on {BRAND.name}.</p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Reviews: only with real, admin-published testimonials (3 or more) */}
                {landingTestimonials.length >= 3 && (
                    <section className="py-20 sm:py-28">
                        <div className={WRAP}>
                            <SectionHeading className="max-w-3xl">What our customers say.</SectionHeading>
                            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {landingTestimonials.slice(0, 6).map((review, index) => (
                                    <figure key={`${review.name}-${index}`} className="neu-raised flex flex-col rounded-[1.75rem] p-6">
                                        <Quote className="h-6 w-6 text-brand-700 dark:text-brand-500" aria-hidden="true" />
                                        <blockquote className="mt-4 flex-1 text-base leading-relaxed text-foreground">{review.quote}</blockquote>
                                        <figcaption className="mt-6 flex items-center justify-between gap-3">
                                            <span>
                                                <span className="block font-semibold text-foreground">{review.name}</span>
                                                <span className="block text-sm text-muted-foreground">{review.role}</span>
                                            </span>
                                            <span className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star key={i} className={cn('h-4 w-4', i < review.rating ? 'fill-brand-600 text-brand-600' : 'text-muted-foreground/40')} />
                                                ))}
                                            </span>
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Developers */}
                <section id="developers" className="scroll-mt-24 py-20 sm:py-28">
                    <div className={cn(WRAP, 'grid gap-10 lg:grid-cols-12 lg:gap-14')}>
                        <div className="lg:col-span-6">
                            <SectionHeading>Building your own app? Plug into ours.</SectionHeading>
                            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                                The developer API places the same orders you place by hand, so your site or app can sell to your customers without you in the loop.
                            </p>
                            <Link href="/developers" className={cn('clay-black mt-8 inline-flex min-h-[3.5rem] items-center gap-2 rounded-full px-8 text-base font-semibold', FOCUS)}>
                                Read the docs
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>
                        <ul className="space-y-4 lg:col-span-6">
                            {DEVELOPER_PRODUCTS.map((p) => (
                                <li key={p.slug}>
                                    <Link href={`/developers/${p.slug}`} className={cn('neu-raised-sm neu-press group flex items-center justify-between gap-4 rounded-2xl px-5 py-4', FOCUS)}>
                                        <span className="font-display text-lg font-semibold text-foreground">{p.name}</span>
                                        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* FAQ */}
                <section className="py-20 sm:py-28">
                    <div className={cn(WRAP, 'grid gap-10 lg:grid-cols-12 lg:gap-14')}>
                        <div className="lg:col-span-4">
                            <SectionHeading>Questions people ask before they sign up.</SectionHeading>
                            {hasContact && (
                                <p className="mt-5 text-muted-foreground">
                                    Still unsure? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={linkClass}>Message us on WhatsApp</a>.
                                </p>
                            )}
                        </div>
                        <div className="space-y-4 lg:col-span-8">
                            {getFaqItems(guestUrl).map((item, index) => {
                                const open = activeFaqIndex === index
                                return (
                                    <div key={item.question} className="neu-raised-sm rounded-2xl">
                                        <h3>
                                            <button
                                                type="button"
                                                aria-expanded={open}
                                                aria-controls={`faq-panel-${index}`}
                                                id={`faq-button-${index}`}
                                                onClick={() => setActiveFaqIndex(open ? null : index)}
                                                className={cn('flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-5 text-left sm:px-6', FOCUS)}
                                            >
                                                <span className="font-display text-lg font-semibold text-foreground sm:text-xl">{item.question}</span>
                                                <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
                                            </button>
                                        </h3>
                                        <div
                                            id={`faq-panel-${index}`}
                                            role="region"
                                            aria-labelledby={`faq-button-${index}`}
                                            className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="neu-inset mx-4 mb-4 rounded-xl p-4 text-base leading-relaxed text-muted-foreground sm:mx-5 sm:p-5">{item.answer}</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>

                {/* Final call to action */}
                <section className="pb-20 pt-6 sm:pb-28">
                    <div className={WRAP}>
                        <div className="clay-gold flex flex-col gap-8 rounded-[2.5rem] px-7 py-12 sm:px-12 sm:py-16 lg:flex-row lg:items-end lg:justify-between">
                            <h2 className="max-w-2xl font-display text-4xl font-bold leading-[1.02] tracking-tight text-black text-balance sm:text-5xl lg:text-6xl">
                                Fund your wallet once. Sell all week.
                            </h2>
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <Link href="/auth?tab=signup" className={cn('clay-black inline-flex min-h-[3.5rem] items-center justify-center gap-2 rounded-full px-8 text-base font-semibold', FOCUS_ON_DARK)}>
                                    Create your account
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                {hasContact && (
                                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cn('clay-silver inline-flex min-h-[3.5rem] items-center justify-center rounded-full px-8 text-base font-semibold', FOCUS)}>
                                        Talk to us on WhatsApp
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Community: only when a WhatsApp group/channel is configured */}
                {hasCommunity && (
                    <section id="community" className="scroll-mt-24 pb-20">
                        <div className={cn(WRAP, 'max-w-3xl')}>
                            <div className="neu-raised rounded-[2rem] p-6 sm:p-9">
                                <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Hear about new prices first.</h2>
                                <p className="mb-6 mt-3 text-muted-foreground">Follow our WhatsApp channel or join the community group for price changes and announcements.</p>
                                <WhatsAppCommunityButtons />
                            </div>
                        </div>
                    </section>
                )}
            </main>

            <LandingFooter
                adminSettings={adminSettings}
                whatsappHref={whatsappHref}
                adminPhone={adminPhone}
                whatsappGroupLink={whatsappGroupLink}
                whatsappChannelLink={whatsappChannelLink}
            />
        </div>
    )
}
