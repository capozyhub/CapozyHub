'use client'

import { formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Coins, Banknote, ShoppingCart, CheckCircle2 } from 'lucide-react'
import { cardSurface, iconBubble, kpiValue, accent, deltaPct } from './dashboard-tokens'
import type { AdminStats, AdminTrends, DashRange } from './use-admin-dashboard'

function Sparkline({ values, color }: { values: number[]; color: string }) {
    if (!values.length) return null
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = max - min || 1
    const w = 96
    const h = 28
    const step = values.length > 1 ? w / (values.length - 1) : w
    const points = values
        .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
        .join(' ')
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full overflow-visible" aria-hidden="true">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function DeltaChip({ current, previous }: { current: number; previous: number }) {
    const d = deltaPct(current, previous)
    if (d.neutral) return null
    const Icon = d.up ? TrendingUp : TrendingDown
    return (
        <span
            className={cn(
                'glass-inset inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
                d.up ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
            )}
        >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {d.pct.toFixed(1)}%
            <span className="sr-only">{d.up ? ' up on the previous period' : ' down on the previous period'}</span>
        </span>
    )
}

interface Kpi {
    label: string
    value: string
    icon: typeof Coins
    iconColor: string
    spark?: number[]
    sparkColor?: string
    delta?: { current: number; previous: number }
}

export function KpiStrip({ stats, trends, range }: { stats: AdminStats | null; trends: AdminTrends | null; range: DashRange }) {
    if (!stats) {
        return (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true" role="status">
                <span className="sr-only">Loading the key figures</span>
                {[...Array(4)].map((_, i) => <div key={i} aria-hidden="true" className={cn(cardSurface, 'h-32 animate-pulse motion-reduce:animate-none')} />)}
            </div>
        )
    }

    const revenue = range === 'today' ? stats.revenueToday : range === '7d' ? stats.revenue7d : stats.revenue30d
    const revenuePrev = range === 'today' ? 0 : range === '7d' ? stats.revenuePrev7d : stats.revenuePrev30d
    const profit = range === 'today' ? stats.profitToday : range === '7d' ? stats.profit7d : stats.profit30d
    const series = trends?.series ?? []
    const ordersInRange = series.reduce((a, p) => a + (p.orders || 0), 0)

    const kpis: Kpi[] = [
        {
            label: 'Revenue', value: formatCurrency(revenue), icon: Coins, iconColor: accent.emerald,
            spark: series.map(p => p.revenue), sparkColor: accent.emerald,
            ...(range !== 'today' ? { delta: { current: revenue, previous: revenuePrev } } : {}),
        },
        {
            label: 'Profit', value: formatCurrency(profit), icon: Banknote, iconColor: accent.yellow,
            spark: series.map(p => p.profit), sparkColor: accent.yellow,
        },
        {
            label: 'Orders', value: String(ordersInRange || stats.todayOrders), icon: ShoppingCart, iconColor: accent.blue,
            spark: series.map(p => p.orders), sparkColor: accent.blue,
        },
        { label: 'Success rate', value: `${stats.successRate}%`, icon: CheckCircle2, iconColor: accent.violet },
    ]

    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map(k => {
                const Icon = k.icon
                return (
                    <div key={k.label} className={cn(cardSurface, 'flex min-w-0 flex-col gap-3 p-4 sm:p-5')}>
                        <div className="flex items-center justify-between gap-2">
                            <span className={iconBubble}><Icon className="h-4 w-4" style={{ color: k.iconColor }} aria-hidden="true" /></span>
                            {k.delta && <DeltaChip current={k.delta.current} previous={k.delta.previous} />}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
                            <p className={cn(kpiValue, 'mt-0.5')}>{k.value}</p>
                        </div>
                        {k.spark && k.spark.length > 1 && (
                            <div className="mt-auto pt-1">
                                <Sparkline values={k.spark} color={k.sparkColor || accent.slate} />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
