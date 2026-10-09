'use client'

import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { DashboardInsights, Growth } from '@/lib/dashboard-insights'

const RANGES = [7, 30] as const
export type Range = (typeof RANGES)[number]

function GrowthChip({ growth, label }: { growth: Growth; label: string }) {
    if (growth.direction === 'none') {
        return <span className="text-xs font-medium text-muted-foreground">No activity yet</span>
    }
    if (growth.direction === 'new') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-500">
                <Sparkles className="h-3 w-3" /> New {label}
            </span>
        )
    }
    const up = growth.direction === 'up'
    const flat = growth.direction === 'flat'
    const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                flat ? 'bg-foreground/10 text-muted-foreground' : up ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400',
            )}
        >
            <Icon className="h-3.5 w-3.5" />
            {flat ? 'No change' : `${Math.abs(growth.pct ?? 0)}%`}
        </span>
    )
}

function insightLine(i: DashboardInsights): string {
    const { spendGrowth, current, bestDay, days } = i
    if (current.orders === 0) return `No orders in the last ${days} days. Your first one will show up here.`
    const parts: string[] = []
    if (spendGrowth.direction === 'up') parts.push(`Spending is up ${spendGrowth.pct}% on the previous ${days} days`)
    else if (spendGrowth.direction === 'down') parts.push(`Spending is down ${Math.abs(spendGrowth.pct ?? 0)}% on the previous ${days} days`)
    else if (spendGrowth.direction === 'flat') parts.push(`Spending is level with the previous ${days} days`)
    else parts.push(`${current.orders} ${current.orders === 1 ? 'order' : 'orders'} so far`)
    if (bestDay) parts.push(`busiest on ${bestDay.label} with ${bestDay.orders} ${bestDay.orders === 1 ? 'order' : 'orders'}`)
    return parts.join(', ') + '.'
}

interface PerformanceCardProps {
    insights: DashboardInsights
    range: Range
    onRangeChange: (r: Range) => void
}

export function PerformanceCard({ insights, range, onRangeChange }: PerformanceCardProps) {
    const [picked, setPicked] = useState<number | null>(null)
    const { series, current, spendGrowth, orderGrowth, successRate } = insights

    const max = useMemo(() => Math.max(1, ...series.map(p => p.orders)), [series])
    const shown = picked !== null && series[picked] ? series[picked] : null
    const W = 600
    const H = 140
    const gap = range === 7 ? 14 : 4
    const barW = (W - gap * (series.length - 1)) / series.length

    return (
        <section aria-label="Performance" className="neu-raised-sm rounded-3xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold">Performance</h2>
                    <p className="text-xs text-muted-foreground">Last {range} days against the {range} before</p>
                </div>
                <div role="group" aria-label="Time range" className="neu-inset flex flex-shrink-0 rounded-full p-1">
                    {RANGES.map(r => (
                        <button
                            key={r}
                            type="button"
                            aria-pressed={range === r}
                            onClick={() => { onRangeChange(r); setPicked(null) }}
                            className={cn(
                                'whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                range === r ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {r} days
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="col-span-2 sm:col-span-1">
                    <p className="text-xs font-medium text-muted-foreground">Spent</p>
                    <p className="mt-1 font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">{formatCurrency(current.spend)}</p>
                    <div className="mt-2"><GrowthChip growth={spendGrowth} label="spending" /></div>
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground">Orders</p>
                    <p className="mt-1 font-display text-2xl font-bold leading-none tracking-tight">{current.orders}</p>
                    <div className="mt-2"><GrowthChip growth={orderGrowth} label="orders" /></div>
                </div>
                <div>
                    <p className="text-xs font-medium text-muted-foreground">Delivered</p>
                    <p className="mt-1 font-display text-2xl font-bold leading-none tracking-tight">{successRate === null ? '—' : `${successRate}%`}</p>
                    <p className="mt-2 text-xs text-muted-foreground">of finished orders</p>
                </div>
            </div>

            <div className="mt-6">
                <div className="mb-2 flex h-5 items-center justify-between text-xs text-muted-foreground" aria-live="polite">
                    {shown ? (
                        <>
                            <span className="font-medium text-foreground">{shown.label}</span>
                            <span>{shown.orders} {shown.orders === 1 ? 'order' : 'orders'} · {formatCurrency(shown.spend)}</span>
                        </>
                    ) : (
                        <span>Tap a bar for the day</span>
                    )}
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" role="img" aria-label={`Daily orders for the last ${range} days`} preserveAspectRatio="none">
                    <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="currentColor" strokeOpacity="0.15" />
                    {series.map((p, i) => {
                        const h = p.orders === 0 ? 3 : Math.max(8, (p.orders / max) * (H - 8))
                        const active = picked === i
                        return (
                            <g key={p.key}>
                                {/* wider invisible target so thin bars stay easy to hit on phones */}
                                <rect
                                    x={i * (barW + gap) - gap / 2}
                                    y={0}
                                    width={barW + gap}
                                    height={H}
                                    fill="transparent"
                                    className="cursor-pointer"
                                    onPointerEnter={() => setPicked(i)}
                                    onClick={() => setPicked(i)}
                                />
                                <rect
                                    x={i * (barW + gap)}
                                    y={H - h}
                                    width={barW}
                                    height={h}
                                    rx={Math.min(6, barW / 2)}
                                    className={cn('cz-bar pointer-events-none', p.orders === 0 ? 'fill-foreground/15' : active ? 'fill-brand-600' : 'fill-brand-500')}
                                    style={{ animationDelay: `${Math.min(i * 14, 420)}ms` }}
                                />
                            </g>
                        )
                    })}
                </svg>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>{series[0]?.label}</span>
                    <span>Today</span>
                </div>
            </div>

            <p className="neu-inset mt-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm leading-snug text-muted-foreground">
                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700 dark:text-brand-500" />
                {insightLine(insights)}
            </p>
        </section>
    )
}
