'use client'

import Link from 'next/link'
import { formatCurrency, cn } from '@/lib/utils'
import { Activity, Zap, ZapOff, AlertTriangle, Package, Banknote, BadgeCheck, RotateCcw } from 'lucide-react'
import { cardSurface, mutedSurface, sectionLabel, accent } from './dashboard-tokens'
import type { AdminStats, EngineStatus } from './use-admin-dashboard'
import type { AdminCounts } from '@/hooks/use-admin-counts'

function Stat({ icon: Icon, label, value, color, href }: { icon: typeof Package; label: string; value: string | number; color: string; href?: string }) {
    const body = (
        <div className={cn(mutedSurface, 'flex h-full items-center gap-3 p-3', href && 'glass-hover')}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1a`, color }}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold leading-snug text-muted-foreground">{label}</p>
                <p className="break-words text-base font-bold tabular-nums text-foreground">{value}</p>
            </div>
        </div>
    )
    return href ? <Link href={href} className="block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:focus-visible:outline-brand-500">{body}</Link> : body
}

export function OperationalHealthPanel({ stats, engine, counts }: { stats: AdminStats | null; engine: EngineStatus | null; counts: AdminCounts }) {
    const autoOn = engine?.autoFulfillmentEnabled ?? false
    const failedRate = engine?.failedRateToday ?? 0
    const engineHealthy = autoOn && failedRate < 10

    return (
        <div className={cn(cardSurface, 'flex flex-col p-5')}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" style={{ color: accent.blue }} />
                    <h2 className={sectionLabel}>Operations</h2>
                </div>
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold',
                        engineHealthy ? 'glass-inset text-emerald-700 dark:text-emerald-400' : 'glass-inset text-rose-700 dark:text-rose-400'
                    )}
                >
                    {autoOn ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
                    {autoOn ? `Engine on · ${failedRate}% fail` : 'Engine off'}
                </span>
            </div>

            <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-3">
                <Stat icon={Package} label="Pending orders" value={counts.pendingOrders} color={accent.yellow} href="/admin/orders" />
                <Stat icon={Activity} label="Processing today" value={counts.pendingFulfillment} color={accent.blue} href="/admin/fulfillment" />
                <Stat icon={AlertTriangle} label="Failed, needs action" value={stats?.failedNeedsAction ?? 0} color={accent.red} href="/admin/orders" />
                <Stat icon={RotateCcw} label="Refunds in total" value={formatCurrency(stats?.refundsAmount ?? 0)} color={accent.violet} href="/admin/orders" />
                <Stat icon={Banknote} label="Withdrawals" value={counts.pendingWithdrawals} color={accent.emerald} href="/admin/shops/withdrawals" />
                <Stat icon={BadgeCheck} label="AFA pending" value={counts.pendingAfa} color={accent.violet} href="/admin/afa-management" />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
                No supplier is connected yet, so orders wait for manual fulfillment.
            </p>
        </div>
    )
}
