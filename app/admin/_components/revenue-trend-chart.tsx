'use client'

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import { Activity } from 'lucide-react'
import { cardSurface, sectionLabel, accent } from './dashboard-tokens'
import type { AdminTrends } from './use-admin-dashboard'

export function RevenueTrendChart({ trends }: { trends: AdminTrends | null }) {
    const data = trends?.series ?? []

    return (
        <div className={cn(cardSurface, 'p-5')}>
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4" style={{ color: accent.emerald }} />
                <h2 className={sectionLabel}>Revenue and profit</h2>
            </div>

            {!trends ? (
                <div className="h-64 animate-pulse rounded-xl bg-foreground/10" />
            ) : data.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No data in this period</div>
            ) : (
                // Axis labels follow the theme's muted text colour, so they read on light and dark glass.
                <div className="h-64 [&_.recharts-cartesian-axis-tick-value]:fill-[hsl(var(--muted-foreground))]" role="img" aria-label={`Revenue and profit over the selected period. Total revenue ${formatCurrency(data.reduce((a, p) => a + (p.revenue || 0), 0))}, total profit ${formatCurrency(data.reduce((a, p) => a + (p.profit || 0), 0))}.`}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                            <defs>
                                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={accent.emerald} stopOpacity={0.35} />
                                    <stop offset="100%" stopColor={accent.emerald} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={accent.yellow} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={accent.yellow} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#88888840" vertical={false} />
                            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={16} />
                            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={48}
                                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                            <Tooltip
                                contentStyle={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(12,12,12,0.92)', color: '#fff', fontSize: 13 }}
                                formatter={(value: any, name: any) => [formatCurrency(Number(value)), name === 'revenue' ? 'Revenue' : 'Profit']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke={accent.emerald} strokeWidth={2} fill="url(#revFill)" />
                            <Area type="monotone" dataKey="profit" stroke={accent.yellow} strokeWidth={2} fill="url(#profitFill)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
