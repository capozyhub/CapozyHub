'use client'

import { useEffect, useRef, useState } from 'react'
import { BRAND } from '@/lib/brand'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import {
    Store, TrendingUp, ShoppingCart, ArrowRight,
    Settings, Share2, Tag, Banknote, Clock, CheckCircle2, XCircle,
    AlertCircle, ExternalLink, Copy, Check, RefreshCcw, Crown,
    MessageCircle, Loader2, Gem, Users, FileText, MessageSquare, Receipt, Inbox
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { Switch } from '@/components/ui/switch'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { ShopInsights } from '@/components/shop/shop-insights'
import { ConfirmationStatusBanner } from '@/components/shop/confirmation-status-banner'
import { PromoCarousel } from '@/components/promo-carousel/PromoCarousel'
import { buildShopDashboardSlides } from '@/lib/promo-carousel/shop-dashboard-slides'

interface ShopProfile {
    id: string
    shop_name: string
    shop_slug: string
    description: string
    approval_status: 'pending' | 'approved' | 'rejected' | 'suspended'
    approval_note: string | null
    is_active: boolean
    owner_phone: string
    whatsapp_number: string | null
    logo_url: string | null
    brand_color: string
    pricing_status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected'
}

interface ShopWallet {
    balance: number
    total_earned: number
    total_withdrawn: number
}

interface ShopStats {
    total_orders: number
    completed_orders: number
    pending_orders: number
    processing_orders: number
    failed_orders: number
    total_revenue: number
    total_profit: number
}

interface RecentOrder {
    id: string
    guest_phone: string
    network?: string
    package_size?: string
    type_name?: string
    quantity?: number
    selling_price: number
    profit: number
    status: string
    created_at: string
    is_rc?: boolean
    source?: string  // 'ussd' | 'ussd_shop' = sold via USSD
}

const statusConfig: Record<ShopProfile['approval_status'], { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: 'Pending review', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500', icon: Clock },
    approved: { label: 'Live', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
    rejected: { label: 'Rejected', className: 'bg-red-500/15 text-red-600 dark:text-red-400', icon: XCircle },
    suspended: { label: 'Suspended', className: 'bg-red-500/15 text-red-600 dark:text-red-400', icon: AlertCircle },
}

const orderStatusChip: Record<string, { label: string; className: string }> = {
    completed: { label: 'Paid out', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    pending: { label: 'Pending', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500' },
    processing: { label: 'Processing', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500' },
    failed: { label: 'Failed', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}

export default function ShopDashboardPage() {
    const { dbUser } = useAuth()
    const [shop, setShop] = useState<ShopProfile | null>(null)
    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [stats, setStats] = useState<ShopStats | null>(null)
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
    const [previousOrders, setPreviousOrders] = useState<RecentOrder[]>([])
    const [dataNote, setDataNote] = useState<'capped' | 'partial-error' | null>(null)
    const [filter, setFilter] = useState<'all' | 'today' | '7d' | '30d'>('all')
    const [loading, setLoading] = useState(true)
    const [isFiltering, setIsFiltering] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [copied, setCopied] = useState(false)

    // Customer order-confirmation SMS toggle (per shop, defaults enabled)
    const [smsConfirmEnabled, setSmsConfirmEnabled] = useState(true)
    const [savingSmsToggle, setSavingSmsToggle]     = useState(false)

    // Utility bills storefront toggle (per shop, defaults OFF — opt-in)
    const [utilitiesEnabled, setUtilitiesEnabled]   = useState(false)
    const [savingUtilityToggle, setSavingUtilityToggle] = useState(false)

    // Utility-bill completion SMS toggle — separate from the general customer-order SMS
    // toggle above (defaults enabled, same convention).
    const [utilitySmsEnabled, setUtilitySmsEnabled] = useState(true)
    const [savingUtilitySmsToggle, setSavingUtilitySmsToggle] = useState(false)

    // Announcement state
    const [shopAnnouncement, setShopAnnouncement] = useState<{ id: string; message: string; is_active: boolean } | null>(null)
    const [annMsg, setAnnMsg] = useState('')
    const [isSavingAnn, setIsSavingAnn] = useState(false)
    const [adminAnnActive, setAdminAnnActive] = useState(false)

    // Guards against the "today" tab's response landing after the "30d" tab's,
    // which used to happen whenever someone switched filters faster than the
    // network could answer — the stats/list would then show the wrong window.
    const fetchSeq = useRef(0)

    const fetchShopData = async () => {
        const seq = ++fetchSeq.current

        if (!shop) {
            setLoading(true)
        } else {
            setIsFiltering(true)
        }

        // --- Stage 1: Fetch the shop profile in isolation ---
        let shopData: any = shop

        if (!shopData) {
            try {
                const { data, error } = await ((supabase as any)
                    .from('shop_profiles')
                    .select('*')
                    .eq('owner_id', dbUser!.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle())

                if (error) throw error
                shopData = data
            } catch (profileErr) {
                console.error('[ShopPage] Failed to fetch shop profile:', profileErr)
                if (seq === fetchSeq.current) { setLoading(false); setIsFiltering(false) }
                return
            }

            if (!shopData) {
                if (seq === fetchSeq.current) { setLoading(false); setIsFiltering(false) }
                return
            }

            if (seq !== fetchSeq.current) return
            setShop(shopData)
            setSmsConfirmEnabled(shopData?.sms_order_confirmation_enabled !== false)
            setUtilitiesEnabled(shopData?.utilities_enabled === true)
            setUtilitySmsEnabled(shopData?.utility_sms_confirmation_enabled !== false)
        }

        // --- Stage 2: Fetch secondary data (wallet, orders) with allSettled ---
        // Failures here never hide the shop dashboard.
        // shop_orders_effective resolves each order's real current status through its
        // retry chain (effective_status) — plain shop_orders.status goes stale on retry
        // since the sync trigger only fires for the original mirror order, not retries.
        const now = new Date()
        // Fetch one extra window behind the current one so growth can be compared.
        let fromIso: string | null = null
        const DAY = 24 * 60 * 60 * 1000
        let windowStart: number | null = null
        let windowLength = 0
        if (filter === 'today') {
            windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
            windowLength = DAY
        } else if (filter === '7d') {
            windowStart = now.getTime() - 7 * DAY
            windowLength = 7 * DAY
        } else if (filter === '30d') {
            windowStart = now.getTime() - 30 * DAY
            windowLength = 30 * DAY
        }
        if (windowStart !== null) {
            const from = new Date(windowStart - windowLength).toISOString()
            fromIso = from
        }

        // Paged reads: Supabase caps one request at 1000 rows, which would silently
        // truncate stats and charts for a busy shop.
        const buildOrders = () => {
            let q = (supabase as any).from('shop_orders_effective').select('*').eq('shop_id', shopData.id)
            if (fromIso) q = q.gte('created_at', fromIso)
            return q.order('created_at', { ascending: false }).order('id', { ascending: false })
        }
        const buildRc = () => {
            let q = (supabase as any).from('results_checker_orders').select('*').eq('shop_id', shopData.id).neq('payment_status', 'pending_payment')
            if (fromIso) q = q.gte('created_at', fromIso)
            return q.order('created_at', { ascending: false }).order('id', { ascending: false })
        }
        const [walletSettled, ordersSettled, rcOrdersSettled] = await Promise.allSettled([
            (supabase as any).from('shop_wallets').select('*').eq('owner_id', dbUser!.id).maybeSingle(),
            fetchAllRows(buildOrders),
            fetchAllRows(buildRc),
        ])

        // A slower, older request resolving after a newer one must never overwrite it.
        if (seq !== fetchSeq.current) return

        if (walletSettled.status === 'fulfilled' && walletSettled.value?.data) {
            setWallet(walletSettled.value.data)
        }

        const ordersRes = ordersSettled.status === 'fulfilled' ? ordersSettled.value : null
        const rcRes = rcOrdersSettled.status === 'fulfilled' ? rcOrdersSettled.value : null
        setDataNote(
            !ordersRes || !rcRes || ordersRes.failed || rcRes.failed ? 'partial-error'
            : ordersRes.truncated || rcRes.truncated ? 'capped' : null,
        )
        const rawDataOrders = ordersRes?.rows ?? []
        const rawRcOrders = rcRes?.rows ?? []
        // Use effective_status (resolves the retry chain) for stats/display, falling
        // back to the raw status for rows with no retry history.
        const dataOrders = rawDataOrders.map((o: any) => ({ ...o, status: o.effective_status || o.status }))

        const mappedRcOrders = rawRcOrders.map((o: any) => ({
            id: o.id,
            guest_phone: o.customer_phone,
            type_name: o.type_name,
            quantity: o.quantity,
            selling_price: o.unit_price * o.quantity,
            profit: o.shop_markup * o.quantity,
            status: o.status,
            created_at: o.created_at,
            is_rc: true,
            source: o.source
        }))

        const fetched = [...dataOrders, ...mappedRcOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const allOrders = windowStart === null ? fetched : fetched.filter((o: any) => new Date(o.created_at).getTime() >= windowStart!)
        setPreviousOrders(windowStart === null ? [] : fetched.filter((o: any) => new Date(o.created_at).getTime() < windowStart!))
        setRecentOrders(allOrders)

        // Calculate stats
        const pending = allOrders.filter((o: any) => o.status === 'pending')
        const completed = allOrders.filter((o: any) => o.status === 'completed')
        const processing = allOrders.filter((o: any) => o.status === 'processing')
        const failed = allOrders.filter((o: any) => o.status === 'failed')

        const earningStatuses = ['pending', 'processing', 'completed']
        const earningsOrders = allOrders.filter((o: any) => earningStatuses.includes(o.status))

        setStats({
            total_orders: allOrders.length,
            completed_orders: completed.length,
            pending_orders: pending.length,
            processing_orders: processing.length,
            failed_orders: failed.length,
            total_revenue: earningsOrders.reduce((sum: number, o: any) => sum + (o.selling_price || 0), 0),
            total_profit: earningsOrders.reduce((sum: number, o: any) => sum + (o.profit || 0), 0),
        })

        setLoading(false)
        setIsFiltering(false)
    }

    const fetchShopAnnouncement = async () => {
        try {
            const res = await fetch('/api/shop/announcements')
            const data = await res.json()
            if (data.announcement) {
                setShopAnnouncement(data.announcement)
                setAnnMsg(data.announcement.message)
            }

            // Also check if admin has one active to show "Locked" state
            const { data: adminAnn } = await supabase
                .from('system_announcements')
                .select('id')
                .eq('is_active', true)
                .in('visible_on', ['storefronts', 'both'])
                .limit(1)
                .maybeSingle()

            setAdminAnnActive(!!adminAnn)
        } catch (err) {
            console.error('Error fetching announcement:', err)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await fetchShopData()
        setIsRefreshing(false)
        toast.success('Dashboard updated')
    }

    useEffect(() => {
        // Shop feature is available to all authenticated users
        if (dbUser) {
            fetchShopData()
            fetchShopAnnouncement()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbUser, filter])

    const shopUrl = shop ? `https://${BRAND.shopHost}/${shop.shop_slug}` : ''

    const copyLink = async () => {
        await navigator.clipboard.writeText(shopUrl)
        setCopied(true)
        toast.success('Shop link copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSaveAnnouncement = async () => {
        if (!annMsg.trim()) {
            toast.error('Message cannot be empty')
            return
        }
        setIsSavingAnn(true)
        try {
            const res = await fetch('/api/shop/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: annMsg })
            })
            const data = await res.json()
            if (res.ok) {
                setShopAnnouncement(data.announcement)
                toast.success('Storefront announcement updated!')
            } else {
                toast.error(data.message || 'Failed to update announcement')
            }
        } catch (err) {
            toast.error('Failed to update announcement')
        } finally {
            setIsSavingAnn(false)
        }
    }

    // Toggle whether customers get an SMS confirmation on each order. Optimistic
    // update; revert on failure so the switch never lies about the saved state.
    const handleToggleSmsConfirm = async (next: boolean) => {
        const prev = smsConfirmEnabled
        setSmsConfirmEnabled(next)
        setSavingSmsToggle(true)
        try {
            const res = await fetch('/api/shop/sms-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success(next ? 'Customers will get order SMS' : 'Order SMS to customers turned off')
            } else {
                setSmsConfirmEnabled(prev)
                toast.error(data.error || 'Could not update SMS setting')
            }
        } catch {
            setSmsConfirmEnabled(prev)
            toast.error('Could not update SMS setting')
        } finally {
            setSavingSmsToggle(false)
        }
    }

    // Toggle whether a completion SMS is sent (from THIS shop's own sender, deducted from
    // its own SMS credits) when one of its utility-bill orders finishes. Separate from
    // handleToggleSmsConfirm — a shop owner may want one on and the other off. Optimistic
    // update; revert on failure — same shape as every other toggle on this page.
    const handleToggleUtilitySms = async (next: boolean) => {
        const prev = utilitySmsEnabled
        setUtilitySmsEnabled(next)
        setSavingUtilitySmsToggle(true)
        try {
            const res = await fetch('/api/shop/utility-sms-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success(next
                    ? 'Utility bill completion SMS turned on'
                    : 'Utility bill completion SMS turned off')
            } else {
                setUtilitySmsEnabled(prev)
                toast.error(data.error || 'Could not update utility SMS setting')
            }
        } catch {
            setUtilitySmsEnabled(prev)
            toast.error('Could not update utility SMS setting')
        } finally {
            setSavingUtilitySmsToggle(false)
        }
    }

    // Toggle whether utility bill payments (ECG/Ghana Water/DSTV/GOtv/StarTimes) appear on
    // this shop's storefront. Optimistic update; revert on failure so the switch never lies
    // about the saved state — same shape as handleToggleSmsConfirm.
    const handleToggleUtilities = async (next: boolean) => {
        const prev = utilitiesEnabled
        setUtilitiesEnabled(next)
        setSavingUtilityToggle(true)
        try {
            const res = await fetch('/api/shop/utility-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: next }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                toast.success(next
                    ? "Utility bills are now on your storefront — you'll earn commission on every sale, added to your shop profit."
                    : 'Utility bills removed from your storefront')
            } else {
                setUtilitiesEnabled(prev)
                if (res.status === 403 && data.error === 'upgrade_required') {
                    toast.error('Upgrade to Agent or Dealer to sell utility bills on your storefront.')
                } else {
                    toast.error(data.error || 'Could not update utility bills setting')
                }
            }
        } catch {
            setUtilitiesEnabled(prev)
            toast.error('Could not update utility bills setting')
        } finally {
            setSavingUtilityToggle(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // No shop yet
    if (!shop) {
        return (
            <div className="neu-raised-sm mx-auto mt-6 flex max-w-lg flex-col items-center gap-5 rounded-3xl p-8 text-center sm:p-10">
                <span className="neu-inset flex h-16 w-16 items-center justify-center rounded-2xl text-brand-700 dark:text-brand-500">
                    <Store className="h-8 w-8" />
                </span>
                <div>
                    <h2 className="font-display text-xl font-bold">Open your own shop</h2>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                        Get a storefront link under your own name and earn profit on every bundle your customers buy.
                    </p>
                </div>
                <Link
                    href="/dashboard/shop/setup"
                    className="clay-gold inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold"
                >
                    <Store className="w-5 h-5" /> Create my shop
                </Link>
            </div>
        )
    }

    const daysLeft = dbUser?.agent_expires_at
        ? Math.ceil((new Date(dbUser.agent_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0

    const isPermanentAgent = (dbUser?.role === 'agent' && dbUser?.agent_expires_at === null) || dbUser?.role === 'dealer'

    const cfg = statusConfig[shop.approval_status]
    const StatusIcon = cfg?.icon || Clock
    const isPending = shop.approval_status === 'pending'
    const shopIsLive = shop.approval_status === 'approved' && shop.pricing_status === 'approved'

    // Quick links — every shop page reachable from the dashboard hub.
    const quickLinks: { href: string; label: string; hint: string; icon: any; external?: boolean }[] = [
        { href: '/dashboard/shop/orders', label: 'Orders', hint: 'Track & retry', icon: ShoppingCart },
        { href: '/dashboard/shop/pricing', label: 'Pricing', hint: 'Set your margin', icon: Tag },
        { href: '/dashboard/shop/withdraw', label: 'Withdraw', hint: 'Cash out profit', icon: Banknote },
        { href: '/dashboard/shop/customers', label: 'Customers', hint: 'Who buys from you', icon: Users },
        { href: '/dashboard/shop/profit-logs', label: 'Profit logs', hint: 'Full ledger', icon: FileText },
        { href: '/dashboard/shop/sms', label: 'SMS', hint: 'Sender & credits', icon: MessageSquare },
        { href: '/dashboard/shop/setup', label: 'Settings', hint: 'Shop & branding', icon: Settings },
        ...(shopIsLive ? [{ href: shopUrl, label: 'Storefront', hint: 'View it live', icon: ExternalLink, external: true }] : []),
    ]

    const checklist = [
        { label: 'Shop approved', done: shop.approval_status === 'approved', href: '/dashboard/shop/setup' },
        { label: 'Prices approved', done: shop.pricing_status === 'approved', href: '/dashboard/shop/pricing' },
        { label: 'Customer SMS switched on', done: smsConfirmEnabled, href: '/dashboard/shop/sms' },
        { label: 'Storefront notice written', done: !!shopAnnouncement?.message, href: '#storefront-notice' },
        { label: 'First sale made', done: (wallet?.total_earned || 0) > 0, href: shopUrl || '/dashboard/shop' },
    ]

    const statCards = [
        { label: 'Sales', value: formatCurrency(stats?.total_revenue || 0), accent: 'text-brand-700 dark:text-brand-500', icon: Banknote },
        { label: 'Profit', value: formatCurrency(stats?.total_profit || 0), accent: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp },
        { label: 'Completed', value: `${stats?.completed_orders || 0}`, accent: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
        { label: 'In progress', value: `${(stats?.pending_orders || 0) + (stats?.processing_orders || 0)}`, accent: 'text-brand-700 dark:text-brand-500', icon: Clock },
    ]

    return (
        <div className="space-y-5 pb-20 md:pb-6">
            {/* ── Hero: identity + balance in one surface ── */}
            <section aria-label="Your shop" className="neu-night relative overflow-hidden rounded-3xl p-5 text-white sm:p-7">
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <span className="neu-night-in flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-brand-500">
                                <Store className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="font-display truncate text-lg font-bold tracking-tight !text-white sm:text-xl">{shop.shop_name}</h1>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', cfg?.className)}>
                                        <StatusIcon className="w-3 h-3" />
                                        {cfg?.label}
                                    </span>
                                    {(dbUser?.role === 'agent' || dbUser?.role === 'dealer') && (
                                        dbUser?.role === 'dealer' ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                                                <Gem className="w-3 h-3" /> Dealer
                                            </span>
                                        ) : isPermanentAgent ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                                                <Crown className="w-3 h-3" /> Lifetime
                                            </span>
                                        ) : (
                                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', daysLeft <= 3 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/80')}>
                                                <Clock className="w-3 h-3" /> {daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        <p className="mt-5 text-xs font-medium text-white/50">Available profit</p>
                        <p className="mt-1 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                            <span className="mr-1.5 text-2xl font-semibold text-brand-500 sm:text-3xl">GH₵</span>
                            {Number(wallet?.balance || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <div className="neu-night-in mt-4 inline-flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm">
                            <span className="text-white/70">
                                Earned <span className="font-semibold text-white">{formatCurrency(wallet?.total_earned || 0)}</span>
                                <span className="mx-2 text-white/30">/</span>
                                Withdrawn <span className="font-semibold text-white">{formatCurrency(wallet?.total_withdrawn || 0)}</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            aria-label="Refresh dashboard"
                            className="neu-night-in inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white/80 disabled:opacity-60"
                        >
                            <RefreshCcw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <Link
                            href="/dashboard/shop/withdraw"
                            className="clay-gold inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold"
                        >
                            Withdraw <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {shopIsLive && (
                    <div className="neu-night-in relative mt-5 flex flex-col items-stretch gap-2 rounded-2xl p-2 sm:flex-row sm:items-center">
                        <span className="truncate flex-1 px-2 py-1.5 font-mono text-xs text-white/70">{shopUrl}</span>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={copyLink} className="clay-silver inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold sm:flex-none">
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied!' : 'Copy link'}
                            </button>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(`Buy data bundles, airtime and more from ${shop.shop_name}: ${shopUrl}`)}`}
                                target="_blank" rel="noopener noreferrer" title="Share on WhatsApp" aria-label="Share on WhatsApp"
                            >
                                <span className="clay-black inline-flex h-9 w-9 items-center justify-center rounded-xl"><Share2 className="w-3.5 h-3.5" /></span>
                            </a>
                            <a href={shopUrl} target="_blank" rel="noopener noreferrer" title="Open shop" aria-label="Open shop">
                                <span className="clay-black inline-flex h-9 w-9 items-center justify-center rounded-xl"><ExternalLink className="w-3.5 h-3.5" /></span>
                            </a>
                        </div>
                    </div>
                )}
            </section>

            {/* ── Confirmation-status warning (only renders when something needs the owner's attention) ── */}
            <ConfirmationStatusBanner />

            {/* ── Promo Carousel ── */}
            <PromoCarousel
                slides={buildShopDashboardSlides({
                    shopIsLive,
                    smsConfirmEnabled,
                    utilitiesEnabled,
                    ownerRole: dbUser?.role,
                    brandColor: /^#([A-Fa-f0-9]{3}){1,4}$/.test(shop.brand_color) ? shop.brand_color : '#F6C30F',
                })}
            />

            {/* ── Go-live checklist (hidden once everything is done) ── */}
            {!checklist.every(c => c.done) && (
                <section aria-label="Setup checklist" className="neu-raised-sm rounded-3xl p-5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-display text-base font-semibold">Get your shop earning</h2>
                        <span className="text-xs font-semibold text-muted-foreground">{checklist.filter(c => c.done).length} of {checklist.length} done</span>
                    </div>
                    <div className="neu-inset mt-3 h-2 overflow-hidden rounded-full">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${(checklist.filter(c => c.done).length / checklist.length) * 100}%` }} />
                    </div>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                        {checklist.map(c => (
                            <li key={c.label}>
                                <Link href={c.href} className="neu-inset flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm">
                                    {c.done
                                        ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                                        : <span className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-muted-foreground/40" />}
                                    <span className={cn('font-medium', c.done && 'text-muted-foreground line-through')}>{c.label}</span>
                                    {!c.done && <ArrowRight className="ml-auto h-4 w-4 text-brand-700 dark:text-brand-500" />}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ── Quick Links ── */}
            <ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-4 md:grid-cols-8">
                {quickLinks.map(({ href, label, hint, icon: Icon, external }) => {
                    const inner = (
                        <span className="neu-raised-sm neu-press group flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 text-center">
                            <span className="neu-inset flex h-9 w-9 items-center justify-center rounded-xl text-brand-700 transition-colors group-hover:text-brand-600 dark:text-brand-500">
                                <Icon className="h-4 w-4" />
                            </span>
                            <span className="text-[11px] font-semibold leading-none text-foreground/80">{label}</span>
                        </span>
                    )
                    return (
                        <li key={label}>
                            {external
                                ? <a href={href} target="_blank" rel="noopener noreferrer" title={hint} className="block">{inner}</a>
                                : <Link href={href} title={hint} className="block">{inner}</Link>}
                        </li>
                    )
                })}
            </ul>

            {/* ── Stats ── */}
            <div className={cn('space-y-2.5 transition-opacity duration-300', (isPending || isFiltering) && 'opacity-50 pointer-events-none')}>
                <div className="flex items-center justify-between px-1">
                    <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold">
                        <TrendingUp className="w-4 h-4 text-brand-700 dark:text-brand-500" /> Performance
                    </h3>
                    <div className="neu-inset flex rounded-xl p-1">
                        {(['all', 'today', '7d', '30d'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn('rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all', filter === f ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground')}
                            >
                                {f === 'all' ? 'All' : f === 'today' ? 'Today' : f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                    {statCards.map(({ label, value, accent, icon: Icon }) => (
                        <div key={label} className="neu-raised-sm rounded-2xl p-3.5">
                            <div className="mb-1 flex items-center gap-1.5">
                                <Icon className={cn('w-3.5 h-3.5', accent)} />
                                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                            </div>
                            <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {dataNote && (
                <p role="status" className="neu-inset rounded-2xl px-4 py-3 text-xs leading-snug text-muted-foreground">
                    {dataNote === 'capped'
                        ? 'You have a lot of orders. These figures use your most recent 10,000, so pick Today, 7D or 30D for exact numbers.'
                        : 'Some orders could not be loaded, so these figures may be incomplete. Tap Refresh to try again.'}
                </p>
            )}

            {/* ── Chart, best sellers, customers ── */}
            <div className={cn('transition-opacity duration-300', (isPending || isFiltering) && 'opacity-50 pointer-events-none')}>
                <ShopInsights orders={recentOrders} previous={previousOrders} window={filter} />
            </div>

            {/* ── Notices, toggles + Activity ── */}
            <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-12', isPending && 'opacity-50 pointer-events-none')}>
                <div className="lg:col-span-4 space-y-4">
                    <div id="storefront-notice" className="neu-raised-sm scroll-mt-24 space-y-3 rounded-3xl p-4">
                        <div className="flex items-center gap-2 font-display text-sm font-semibold"><MessageCircle className="w-4 h-4 text-brand-700 dark:text-brand-500" /> Storefront notice</div>
                        {adminAnnActive && (
                            <div className="neu-inset flex items-center gap-2 rounded-xl p-2.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                A system-wide admin announcement is active. Your notice is temporarily disabled.
                            </div>
                        )}
                        <textarea
                            title="Storefront Notice"
                            placeholder="Enter your storefront notice here..."
                            className="well w-full min-h-[90px] rounded-xl border-0 p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            value={annMsg}
                            onChange={(e) => setAnnMsg(e.target.value)}
                            disabled={adminAnnActive}
                        />
                        <button
                            type="button"
                            onClick={handleSaveAnnouncement}
                            disabled={adminAnnActive || isSavingAnn || !annMsg.trim()}
                            className="clay-gold flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold disabled:opacity-60"
                        >
                            {isSavingAnn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save notice'}
                        </button>
                    </div>

                    {/* Customer SMS confirmation toggle */}
                    <div id="sms-confirm-toggle" className="neu-raised-sm scroll-mt-24 rounded-3xl p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 font-display text-sm font-semibold">
                                    <MessageSquare className="w-4 h-4 text-brand-700 dark:text-brand-500" /> Customer order SMS
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Text customers a confirmation each time they order from your shop.
                                </p>
                            </div>
                            <Switch
                                checked={smsConfirmEnabled}
                                onCheckedChange={handleToggleSmsConfirm}
                                disabled={savingSmsToggle}
                                aria-label="Send order confirmation SMS to customers"
                            />
                        </div>
                    </div>

                    {/* Utility bills storefront toggle */}
                    <div id="bill-pay-toggle" className="neu-raised-sm scroll-mt-24 rounded-3xl p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 font-display text-sm font-semibold">
                                    <Receipt className="w-4 h-4 text-brand-700 dark:text-brand-500" /> Utility bills on my storefront
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Let customers pay ECG, Ghana Water, DSTV, GOtv and StarTimes bills from your shop.
                                </p>
                            </div>
                            <Switch
                                checked={utilitiesEnabled}
                                onCheckedChange={handleToggleUtilities}
                                disabled={savingUtilityToggle}
                                aria-label="Sell utility bill payments on my storefront"
                            />
                        </div>
                        {utilitiesEnabled && (
                            <div className="mt-3 flex items-start justify-between gap-3 border-t border-white/5 pt-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 font-display text-sm font-semibold">
                                        <MessageSquare className="w-4 h-4 text-brand-700 dark:text-brand-500" /> Utility bill completion SMS
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Text the customer when their bill payment completes, from your own sender — uses your SMS credits.
                                    </p>
                                </div>
                                <Switch
                                    checked={utilitySmsEnabled}
                                    onCheckedChange={handleToggleUtilitySms}
                                    disabled={savingUtilitySmsToggle}
                                    aria-label="Send utility bill completion SMS to customers"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <section aria-label="Recent activity" className="neu-raised-sm flex flex-col rounded-3xl p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="font-display text-sm font-semibold">Recent activity</h3>
                            <Link href="/dashboard/shop/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-500">
                                View all <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="mt-3 flex-1 overflow-y-auto max-h-[440px]">
                            {recentOrders.length === 0 ? (
                                <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                                    <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground"><Inbox className="h-5 w-5" /></span>
                                    <p className="text-sm text-muted-foreground">No sales yet. Share your link to start earning!</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {recentOrders.slice(0, 30).map((order) => {
                                        const chip = orderStatusChip[order.status] ?? { label: order.status, className: 'bg-foreground/10 text-muted-foreground' }
                                        return (
                                            <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold', order.is_rc ? 'bg-brand-500/15 text-brand-700 dark:text-brand-500' : 'neu-inset text-brand-700 dark:text-brand-500')}>
                                                        {order.is_rc ? 'RC' : order.network?.charAt(0) || 'D'}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-foreground">
                                                            {order.is_rc ? `${order.quantity}x ${order.type_name}` : `${order.network} ${order.package_size}`}
                                                        </p>
                                                        <p className="truncate text-xs text-muted-foreground">{order.guest_phone}</p>
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0 text-right">
                                                    <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(order.selling_price)}</p>
                                                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', chip.className)}>+{formatCurrency(order.profit)}</span>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
