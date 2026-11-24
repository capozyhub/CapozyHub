'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ChevronDown, Loader2, Search } from 'lucide-react'
import { BrandLogo } from '@/components/ui/brand'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { TermsSectionsLive } from '@/components/terms/terms-sections-live'
import { ClayButton, Notice } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

interface ShopSearchResult {
    shop_slug: string
    shop_name: string
    description: string | null
    logo_url: string | null
    owner_phone: string
}

// Failed searches allowed before a short pause
const MAX_ATTEMPTS = 5
// Wait between searches (seconds)
const SEARCH_COOLDOWN_SEC = 10
// Pause after MAX_ATTEMPTS failed searches (seconds)
const LOCKOUT_DURATION_SEC = 120

export default function ShopDomainDiscoveryPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<ShopSearchResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [error, setError] = useState(false)

    const [cooldownSec, setCooldownSec] = useState(0)
    const [attempts, setAttempts] = useState(0)
    const [lockoutSec, setLockoutSec] = useState(0)

    const [termsOpen, setTermsOpen] = useState(false)
    const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
    const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null)
    // Only the newest search may update the screen, so a slow earlier reply cannot overwrite it.
    const searchSeq = useRef(0)

    const isLockedOut = lockoutSec > 0
    const isCooling = cooldownSec > 0

    useEffect(() => () => {
        if (cooldownTimer.current) clearInterval(cooldownTimer.current)
        if (lockoutTimer.current) clearInterval(lockoutTimer.current)
    }, [])

    const startCooldown = () => {
        setCooldownSec(SEARCH_COOLDOWN_SEC)
        if (cooldownTimer.current) clearInterval(cooldownTimer.current)
        cooldownTimer.current = setInterval(() => {
            setCooldownSec(prev => {
                if (prev <= 1) { clearInterval(cooldownTimer.current!); return 0 }
                return prev - 1
            })
        }, 1000)
    }

    const startLockout = () => {
        setLockoutSec(LOCKOUT_DURATION_SEC)
        if (lockoutTimer.current) clearInterval(lockoutTimer.current)
        lockoutTimer.current = setInterval(() => {
            setLockoutSec(prev => {
                if (prev <= 1) { clearInterval(lockoutTimer.current!); setAttempts(0); return 0 }
                return prev - 1
            })
        }, 1000)
    }

    const recordMiss = () => {
        const next = attempts + 1
        setAttempts(next)
        if (next >= MAX_ATTEMPTS) startLockout()
        else startCooldown()
    }

    const performSearch = async () => {
        const trimmed = query.trim()
        if (trimmed.length < 2) return
        const seq = ++searchSeq.current

        setIsLoading(true)
        setError(false)
        setHasSearched(true)
        setResults([])

        try {
            const res = await fetch(`/api/shop-domain/search?q=${encodeURIComponent(trimmed)}`)
            if (!res.ok) throw new Error('Search failed')
            const data: ShopSearchResult[] = await res.json()
            if (seq !== searchSeq.current) return
            setResults(data || [])
            if (!data || data.length === 0) {
                recordMiss()
            } else {
                setAttempts(0)
                startCooldown()
            }
        } catch {
            if (seq !== searchSeq.current) return
            setError(true)
        } finally {
            if (seq === searchSeq.current) setIsLoading(false)
        }
    }

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (query.trim().length < 2 || isLockedOut || isCooling || isLoading) return
        performSearch()
    }

    const attemptsLeft = MAX_ATTEMPTS - attempts
    const buttonLabel = isLoading ? 'Searching' : isCooling ? `Wait ${cooldownSec}s` : 'Search'

    return (
        <div className="flex min-h-[100dvh] flex-col bg-black">
            <header className="relative isolate overflow-hidden bg-black px-6 pb-24 pt-8 text-white sm:px-10">
                <BrandSwoosh className="pointer-events-none absolute -bottom-6 -right-[30%] -z-10 w-full opacity-90 sm:-right-[8%] sm:w-[65%]" />
                <div className="mx-auto max-w-2xl">
                    <Link href="/" aria-label={BRAND.name} className="flex w-fit items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
                        <BrandLogo width={40} height={40} className="h-10 w-10" />
                        <span className="font-display text-xl font-bold tracking-tight">
                            {BRAND.nameFirst} <span className="text-brand-500">{BRAND.nameSecond}</span>
                        </span>
                    </Link>
                    <h1 className="mt-10 font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl">
                        Find your shop.
                    </h1>
                    <p className="mt-4 max-w-md text-lg leading-relaxed text-silver-200">
                        Look up the shop you buy from and order data, airtime and vouchers in minutes.
                    </p>
                </div>
            </header>

            <main className="relative -mt-8 flex-1 rounded-t-[2rem] bg-neu px-5 pb-16 pt-8 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] sm:px-10">
                <div className="mx-auto w-full max-w-2xl space-y-8">
                    <section className="neu-raised space-y-5 rounded-[2rem] p-6 sm:p-7" aria-labelledby="search-title">
                        <div>
                            <h2 id="search-title" className="font-display text-xl font-bold tracking-tight">Search for a shop</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Enter the full shop name, the full shop link, the owner&apos;s 10-digit number or the 4-digit shop code. Partial entries return nothing.
                            </p>
                        </div>

                        {isLockedOut ? (
                            <div className="space-y-4">
                                <Notice tone="info">
                                    Too many searches without a match. You can search again in{' '}
                                    <span className="font-semibold tabular-nums">{lockoutSec}s</span>.
                                </Notice>
                                <a
                                    href={BRAND.siteUrl}
                                    className={cn('clay-black flex min-h-[3.25rem] items-center justify-center rounded-full px-6 text-base font-semibold', FOCUS)}
                                >
                                    Go to {BRAND.name}
                                </a>
                            </div>
                        ) : (
                            <form onSubmit={handleSearch} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="shop-query" className="text-sm font-semibold">Shop name, link, number or code</label>
                                    <div className="neu-inset rounded-xl">
                                        <input
                                            id="shop-query"
                                            type="text"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            readOnly={isLoading}
                                            autoComplete="off"
                                            placeholder="e.g. 0241234567"
                                            className="h-12 w-full rounded-xl bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-brand-500"
                                        />
                                    </div>
                                </div>
                                <ClayButton type="submit" disabled={isCooling || query.trim().length < 2} loading={isLoading}>
                                    {!isLoading && <Search className="h-4 w-4" aria-hidden="true" />}
                                    {buttonLabel}
                                </ClayButton>
                                {(isCooling || attempts > 0) && (
                                    <p className="text-center text-xs text-muted-foreground" role="status">
                                        {isCooling ? `You can search again in ${cooldownSec}s. ` : ''}
                                        {attempts > 0 ? `${attemptsLeft} search${attemptsLeft !== 1 ? 'es' : ''} left before a short pause.` : ''}
                                    </p>
                                )}
                            </form>
                        )}
                    </section>

                    {!isLockedOut && (
                        <section aria-live="polite" aria-label="Search results">
                            {isLoading && (
                                <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Looking for shops
                                </p>
                            )}
                            {error && <Notice>We could not search right now. Try again in a moment.</Notice>}
                            {!isLoading && !error && hasSearched && results.length === 0 && (
                                <div className="neu-inset rounded-3xl p-6 text-center">
                                    <p className="font-semibold">No shop found</p>
                                    <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                                        Check that you entered the complete name, link, 10-digit number or 4-digit code.
                                    </p>
                                </div>
                            )}
                            {results.length > 0 && !isLoading && (
                                <div className="space-y-3">
                                    <p className="px-1 text-sm font-semibold text-muted-foreground">
                                        {results.length} shop{results.length !== 1 ? 's' : ''} found
                                    </p>
                                    <ul className="space-y-3">
                                        {results.map((shop) => (
                                            <li key={shop.shop_slug}>
                                                <Link
                                                    href={`/${shop.shop_slug}`}
                                                    className={cn('neu-raised-sm neu-press group flex items-center gap-4 rounded-3xl p-4', FOCUS)}
                                                >
                                                    {shop.logo_url ? (
                                                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
                                                            <Image src={shop.logo_url} alt="" fill className="object-cover" sizes="56px" />
                                                        </span>
                                                    ) : (
                                                        <span className="clay-gold flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-xl font-bold" aria-hidden="true">
                                                            {shop.shop_name.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate font-display text-lg font-bold capitalize tracking-tight">{shop.shop_name}</span>
                                                        {shop.description && (
                                                            <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">{shop.description}</span>
                                                        )}
                                                    </span>
                                                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                                    <span className="sr-only">Open {shop.shop_name}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    <section id="terms" className="neu-raised-sm rounded-3xl">
                        <button
                            type="button"
                            onClick={() => setTermsOpen(o => !o)}
                            aria-expanded={termsOpen}
                            aria-controls="terms-panel"
                            className={cn('flex w-full items-center justify-between gap-3 rounded-3xl p-5 text-left font-display text-base font-bold', FOCUS)}
                        >
                            Terms and conditions
                            <ChevronDown className={cn('h-5 w-5 transition-transform motion-reduce:transition-none', termsOpen && 'rotate-180')} aria-hidden="true" />
                        </button>
                        {termsOpen && (
                            <div id="terms-panel" className="border-t border-border px-5 pb-6 pt-5">
                                <TermsSectionsLive className="space-y-6" />
                            </div>
                        )}
                    </section>
                </div>
            </main>

            <footer className="bg-black px-6 py-8 text-center text-sm text-silver-200/80">
                &copy; {new Date().getFullYear()} {BRAND.name}. Shop directory.
            </footer>
        </div>
    )
}
