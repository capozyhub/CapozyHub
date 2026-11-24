'use client'

import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface WalletStatsCardProps {
    balance: number
    totalCredited: number
    totalSpent: number
}

/** Wallet balance with lifetime totals, on a black stage. */
export function WalletStatsCard({ balance, totalCredited, totalSpent }: WalletStatsCardProps) {
    return (
        <section aria-label="Wallet summary" className="neu-night rounded-[2rem] p-6 text-white sm:p-7">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-brand-400">
                        <Wallet className="h-4 w-4" aria-hidden="true" /> Wallet balance
                    </p>
                    <p className="mt-1 font-display text-4xl font-bold tracking-tight tabular-nums">{formatCurrency(balance)}</p>
                </div>
                <dl className="grid grid-cols-2 gap-6">
                    <div>
                        <dt className="flex items-center gap-1.5 text-sm text-silver-200">
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Added in total
                        </dt>
                        <dd className="mt-0.5 font-display text-xl font-bold tabular-nums">{formatCurrency(totalCredited)}</dd>
                    </div>
                    <div>
                        <dt className="flex items-center gap-1.5 text-sm text-silver-200">
                            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" /> Spent in total
                        </dt>
                        <dd className="mt-0.5 font-display text-xl font-bold tabular-nums">{formatCurrency(totalSpent)}</dd>
                    </div>
                </dl>
            </div>
        </section>
    )
}
