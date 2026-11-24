'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useAdminCounts } from '@/hooks/use-admin-counts'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { useAdminDashboard, type DashRange } from './_components/use-admin-dashboard'
import { TimeRange } from './_components/time-range'
import { KpiStrip } from './_components/kpi-strip'
import { RevenueTrendChart } from './_components/revenue-trend-chart'
import { FloatHealthCard } from './_components/float-health-card'
import { OperationalHealthPanel } from './_components/operational-health-panel'
import { SystemControlCenter } from './_components/system-control-center'
import { NetworkBreakdown } from './_components/network-breakdown'
import { ProductSourceBreakdown } from './_components/product-source-breakdown'
import { GrowthPanel } from './_components/growth-panel'
import { TopMovers } from './_components/top-movers'
import { ActivityFeed } from './_components/activity-feed'
import { ActionRequiredRail, totalActions } from './_components/action-required-rail'
import { QuickActions } from './_components/quick-actions'
import { cardSurface, focusRing } from './_components/dashboard-tokens'

/** Morning, afternoon or evening, worked out in the browser so it matches the admin's own clock. */
function useGreeting() {
    const [greeting, setGreeting] = useState('Welcome back')
    useEffect(() => {
        const h = new Date().getHours()
        setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    }, [])
    return greeting
}

export default function AdminDashboardPage() {
    const [range, setRange] = useState<DashRange>('today')
    const { isSubAdmin, dbUser } = useAuth()
    const { counts } = useAdminCounts()
    const { stats, trends, activity, engine, degraded, isLoading, error, refresh } = useAdminDashboard(range)
    const greeting = useGreeting()

    const actions = totalActions(counts)
    const firstName = dbUser?.first_name?.trim()

    if (error) {
        return (
            <div className="relative isolate overflow-x-clip">
                <div aria-hidden="true" className="glass-aurora pointer-events-none absolute -inset-x-4 -top-6 -z-10 h-[34rem] lg:-inset-x-6" />
                <div className={cn(cardSurface, 'mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center')} role="alert">
                    <span className="glass-inset flex h-12 w-12 items-center justify-center rounded-full">
                        <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                    </span>
                    <h1 className="font-display text-xl font-bold text-foreground">The dashboard did not load</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
                    <button
                        type="button"
                        onClick={refresh}
                        className={cn('clay-gold mt-2 inline-flex min-h-[3rem] items-center gap-2 rounded-full px-6 text-sm font-semibold', focusRing)}
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="relative isolate space-y-6 overflow-x-clip">
            {/* The glow the glass blurs. Decorative, behind everything. */}
            <div aria-hidden="true" className="glass-aurora pointer-events-none absolute -inset-x-4 -top-6 -z-10 h-[64rem] lg:-inset-x-6" />

            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-500" />
                        {BRAND.name} admin
                    </p>
                    <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-balance text-foreground sm:text-3xl">
                        {greeting}{firstName ? `, ${firstName}` : ''}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                        {actions > 0
                            ? `${actions} ${actions === 1 ? 'thing needs' : 'things need'} you. Here is the rest of the picture.`
                            : 'Nothing is waiting on you. Here is how the platform is doing.'}
                    </p>
                </div>
                <TimeRange value={range} onChange={setRange} />
            </header>

            {degraded && (
                <div role="status" className={cn(cardSurface, 'flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-amber-900 dark:text-amber-300')}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>Revenue and balance figures are unavailable right now because the stats service is slow. Counts may be incomplete.</span>
                </div>
            )}

            <ActionRequiredRail counts={counts} />

            <KpiStrip stats={stats} trends={trends} range={range} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2 [&>*]:h-full"><RevenueTrendChart trends={trends} /></div>
                <FloatHealthCard stats={stats} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2 [&>*]:h-full"><OperationalHealthPanel stats={stats} engine={engine} counts={counts} /></div>
                <SystemControlCenter />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <NetworkBreakdown rows={trends?.byNetwork ?? null} />
                <GrowthPanel stats={stats} counts={counts} />
            </div>

            <ProductSourceBreakdown byCategory={trends?.byCategory ?? null} bySource={trends?.bySource ?? null} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="space-y-5 lg:col-span-2">
                    <TopMovers trends={trends} />
                    <QuickActions isSubAdmin={isSubAdmin} />
                </div>
                <ActivityFeed items={activity} isLoading={isLoading} />
            </div>
        </div>
    )
}
