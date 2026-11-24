'use client'

import Link from 'next/link'
import { formatCurrency, cn } from '@/lib/utils'
import { Scale, ArrowRight } from 'lucide-react'
import { cardSurface, sectionLabel, focusRing, accent } from './dashboard-tokens'
import type { AdminStats } from './use-admin-dashboard'

export function FloatHealthCard({ stats }: { stats: AdminStats | null }) {
    if (!stats) return <div className={cn(cardSurface, 'h-full min-h-[180px] animate-pulse')} />

    const liability = stats.totalWalletBalance || 0
    const debt = stats.outstandingDebt || 0
    // Health: debt as a share of total float. Higher debt ratio = worse.
    const ratio = liability > 0 ? debt / liability : debt > 0 ? 1 : 0
    const health = ratio >= 0.25 ? 'critical' : ratio >= 0.1 ? 'warning' : 'healthy'
    const dot = health === 'critical' ? accent.red : health === 'warning' ? accent.yellow : accent.emerald
    const healthLabel = health === 'critical' ? 'Elevated debt' : health === 'warning' ? 'Watch' : 'Healthy'

    return (
        <div className={cn(cardSurface, 'p-5 flex flex-col h-full')}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4" style={{ color: accent.slate }} />
                    <h2 className={sectionLabel}>Float and liability</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />
                    {healthLabel}
                </span>
            </div>

            <div className="space-y-3 flex-1">
                <div>
                    <p className="text-xs text-muted-foreground">Wallet liability (held for users)</p>
                    <p className="break-words font-display text-2xl font-bold tabular-nums tracking-tight text-foreground">{formatCurrency(liability)}</p>
                </div>
                <div className="h-px bg-foreground/10" />
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground">Outstanding debt owed to you</p>
                        <p className={cn('text-xl font-bold tracking-tight', debt > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-foreground')}>
                            {formatCurrency(debt)}
                        </p>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">{stats.debtorCount} debtor{stats.debtorCount !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {debt > 0 && (
                <Link href="/admin/top-up?tab=settlements" className={cn('mt-4 inline-flex items-center gap-1 rounded text-xs font-bold text-rose-700 transition-all hover:gap-1.5 motion-reduce:transition-none dark:text-rose-400', focusRing)}>
                    Review settlements <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            )}
        </div>
    )
}
