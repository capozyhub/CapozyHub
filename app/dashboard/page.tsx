'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { usePageAccess } from '@/hooks/use-page-access'
import { supabase } from '@/lib/supabase'
import { buildInsights, type InsightAfa, type InsightOrder } from '@/lib/dashboard-insights'
import { buildDashboardSlides } from '@/lib/promo-carousel/dashboard-slides'
import { PromoCarousel } from '@/components/promo-carousel/PromoCarousel'
import { WebsiteRequestBanner } from '@/components/dashboard/WebsiteRequestBanner'
import { HomeHero } from '@/components/dashboard/home/HomeHero'
import { PerformanceCard, type Range } from '@/components/dashboard/home/PerformanceCard'
import { OrderMix } from '@/components/dashboard/home/OrderMix'
import { QuickActions } from '@/components/dashboard/home/QuickActions'
import { RecentOrders, type RecentOrder } from '@/components/dashboard/home/RecentOrders'
import { MembershipCard } from '@/components/dashboard/home/MembershipCard'

interface ActiveWebsiteRequest {
    id: string
    status: 'new' | 'contacted' | 'closed'
    request_type: 'full_request' | 'call_request'
    created_at: string
}

// Two 30-day windows: the one shown and the one before it, so growth can be compared.
const HISTORY_DAYS = 60
// Cap on rows pulled for the charts. Keeps the payload small for very busy accounts.
const HISTORY_LIMIT = 3000

interface HomeData {
    balance: number
    orders: InsightOrder[]
    afa: InsightAfa[]
    recent: RecentOrder[]
    websiteRequest: ActiveWebsiteRequest | null
    hasShop: boolean
}

function HomeSkeleton() {
    return (
        <div className="space-y-5" aria-busy="true" aria-label="Loading your dashboard">
            <div className="neu-raised-sm h-56 rounded-3xl" />
            <div className="grid gap-5 lg:grid-cols-12">
                <div className="neu-raised-sm h-96 rounded-3xl lg:col-span-8" />
                <div className="neu-raised-sm h-96 rounded-3xl lg:col-span-4" />
            </div>
        </div>
    )
}

export default function DashboardPage() {
    const { dbUser, isAdmin } = useAuth()
    const { activeAnnouncement, reopenAnnouncement } = useUI()
    const { isPageAccessible } = usePageAccess()
    const [data, setData] = useState<HomeData | null>(null)
    const [failed, setFailed] = useState(false)
    const [range, setRange] = useState<Range>(7)

    const userId = dbUser?.id

    const load = useCallback(async () => {
        if (!userId) return
        setFailed(false)
        const now = new Date()
        const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (HISTORY_DAYS - 1)).toISOString()
        try {
            const [ordersRes, afaRes, recentRes, walletRes, requestRes, shopRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('created_at, status, price, network')
                    .eq('user_id', userId as any)
                    .is('shop_order_id', null)
                    .gte('created_at', since)
                    .order('created_at', { ascending: false })
                    .limit(HISTORY_LIMIT),
                // The price column on this table is `payment_amount`; `amount` does not exist.
                supabase.from('afa_orders').select('created_at, status, payment_amount').eq('user_id', userId as any).gte('created_at', since).limit(HISTORY_LIMIT),
                supabase
                    .from('orders')
                    .select('id, reference_code, network, size, price, status, created_at, phone_number')
                    .eq('user_id', userId as any)
                    .is('shop_order_id', null)
                    .order('created_at', { ascending: false })
                    .limit(5),
                supabase.from('wallets').select('balance').eq('user_id', userId as any).single(),
                // A failure here (for example a migration not applied yet) reads as "no active request".
                (supabase as any)
                    .from('website_requests')
                    .select('id, status, request_type, created_at')
                    .eq('user_id', userId)
                    .in('status', ['new', 'contacted'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                supabase.from('shop_profiles').select('id').eq('owner_id', userId as any).maybeSingle(),
            ])

            // Orders are the page's backbone; the rest degrade quietly.
            if (ordersRes.error) throw ordersRes.error

            setData({
                balance: (walletRes.data as any)?.balance || 0,
                orders: (ordersRes.data ?? []) as InsightOrder[],
                afa: (afaRes.error ? [] : afaRes.data ?? []) as InsightAfa[],
                recent: (recentRes.error ? [] : recentRes.data ?? []) as unknown as RecentOrder[],
                websiteRequest: requestRes?.error ? null : (requestRes?.data ?? null),
                hasShop: !shopRes?.error && !!shopRes?.data,
            })
        } catch (error) {
            console.error('Error loading the dashboard:', error)
            setFailed(true)
        }
    }, [userId])

    useEffect(() => { load() }, [load])

    const insights = useMemo(
        () => (data ? buildInsights(data.orders, data.afa, range) : null),
        [data, range],
    )

    if (failed && !data) {
        return (
            <div className="neu-raised-sm mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-3xl p-8 text-center">
                <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-red-500"><AlertCircle className="h-6 w-6" /></span>
                <h1 className="font-display text-lg font-semibold">We couldn&apos;t load your dashboard</h1>
                <p className="text-sm text-muted-foreground">Check your connection and try again. Your orders and balance are safe.</p>
                <button type="button" onClick={load} className="clay-gold mt-1 inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold">
                    <RefreshCw className="h-4 w-4" /> Try again
                </button>
            </div>
        )
    }

    if (!data || !insights) return <HomeSkeleton />

    const showTopUp = !(process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true' && !isAdmin) && isPageAccessible('/dashboard/wallet')
    const canRecruit = isAdmin || dbUser?.role === 'agent' || dbUser?.role === 'dealer'

    return (
        <div className="space-y-5">
            <h1 className="sr-only">Dashboard</h1>

            <HomeHero
                firstName={dbUser?.first_name || 'there'}
                balance={data.balance}
                todayOrders={insights.today.orders}
                todaySpend={insights.today.spend}
                showTopUp={showTopUp}
            />

            <WebsiteRequestBanner activeRequest={data.websiteRequest} />

            <QuickActions canRecruit={canRecruit} />

            <div className="grid gap-5 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <PerformanceCard insights={insights} range={range} onRangeChange={setRange} />
                </div>
                <div className="lg:col-span-4">
                    <OrderMix insights={insights} />
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-12">
                <div className="lg:col-span-7">
                    <RecentOrders orders={data.recent} />
                </div>
                <div className="lg:col-span-5">
                    <MembershipCard />
                </div>
            </div>

            <section aria-label="Discover">
                <PromoCarousel
                    slides={buildDashboardSlides({
                        role: dbUser?.role,
                        hasShop: data.hasShop,
                        announcement: activeAnnouncement,
                        onOpenAnnouncement: reopenAnnouncement,
                    })}
                />
            </section>
        </div>
    )
}
