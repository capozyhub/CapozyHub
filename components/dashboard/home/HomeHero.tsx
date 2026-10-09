'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { BrandSwoosh } from '@/components/brand-swoosh'
import { useCountUp } from '@/hooks/use-count-up'
import { formatCurrency } from '@/lib/utils'

function greetingFor(hour: number): string {
    if (hour < 5) return 'Still up'
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    if (hour < 21) return 'Good evening'
    return 'Good night'
}

interface HomeHeroProps {
    firstName: string
    balance: number
    todayOrders: number
    todaySpend: number
    showTopUp: boolean
}

export function HomeHero({ firstName, balance, todayOrders, todaySpend, showTopUp }: HomeHeroProps) {
    // Time-of-day text is filled in after mount so it always matches the member's own clock.
    const [now, setNow] = useState<Date | null>(null)
    useEffect(() => setNow(new Date()), [])
    const amount = useCountUp(balance, 700, 2)

    return (
        <section
            id="wallet-card"
            aria-label="Wallet"
            className="neu-night relative overflow-hidden rounded-3xl p-5 text-white sm:p-7"
        >
            <BrandSwoosh progress={1} className="pointer-events-none absolute -right-16 bottom-0 w-[28rem] max-w-none opacity-40 sm:-right-8 sm:opacity-50 lg:opacity-30" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-white/60">
                        {now ? `${greetingFor(now.getHours())}, ${firstName}` : `Welcome, ${firstName}`}
                    </p>
                    <p className="mt-3 text-xs font-medium text-white/50">Wallet balance</p>
                    <p className="mt-1 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                        <span className="mr-1.5 text-2xl font-semibold text-brand-500 sm:text-3xl">GH₵</span>
                        {Number(amount).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>

                    <div className="neu-night-in mt-5 inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
                        <span className="text-white/70">
                            Today <span className="font-semibold text-white">{todayOrders} {todayOrders === 1 ? 'order' : 'orders'}</span>
                            <span className="mx-2 text-white/30">/</span>
                            <span className="font-semibold text-white">{formatCurrency(todaySpend)}</span> spent
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-shrink-0">
                    {showTopUp && (
                        <Link
                            href="/dashboard/wallet"
                            className="clay-gold inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        >
                            <Plus className="h-4 w-4" /> Top up wallet
                        </Link>
                    )}
                    <Link
                        href="/dashboard/data-packages"
                        className="clay-silver inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                        <Package className="h-4 w-4" /> Buy data
                    </Link>
                </div>
            </div>
        </section>
    )
}
