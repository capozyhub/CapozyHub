'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    ShoppingCart, Clock, CheckCircle2, XCircle, TrendingUp,
    Search, ArrowLeft, AlertCircle, RefreshCcw, MessageSquare, FileText, Coins, Smartphone, Hourglass, RefreshCw, AlertTriangle, IdCard, Ban, Zap, Inbox
} from 'lucide-react'

// Mashup orders share airtime's shape (package_id == null); distinguish by
// package_size, same detection the storefront success page already uses.
const isMashupOrder = (packageSize?: string | null) => !!packageSize?.toLowerCase().includes('mashup')
import { toast } from '@/lib/toast'
import Link from 'next/link'
import { format, differenceInHours } from 'date-fns'
import { getRetryTag, isConfirmReceivedEligible, getSelfCompletedTag } from '@/lib/order-status'
import { pageToRange, escapeLikePattern, ORDER_HISTORY_PAGE_SIZE } from '@/lib/pagination'
import { PaginationControls } from '@/components/shared/pagination-controls'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MomoDetailsModal } from '@/components/shared/momo-details-modal'
import { isMomoLookupEligible } from '@/lib/momo-eligibility'
import { UTILITY_BILLER_KEYS, UTILITY_BILLERS, type UtilityBiller } from '@/lib/hubtel-utility/billers'

interface ShopOrder {
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
    order_type?: string
    package_id?: string | null
    is_rc?: boolean
    is_utility?: boolean
    biller?: UtilityBiller
    // 'ussd' (data/airtime) or 'ussd_shop' (results checker) = sold via USSD;
    // 'website'/null = sold online. Drives the USSD tag in the table.
    source?: string
    reference_code?: string
    orders?: {
        id: string
        status?: string
        refunded_at?: string | null
        retry_count?: number | null
        retry_from_status?: string | null
        retry_of_order_id?: string | null
        retried_by_role?: string | null
        self_completed_at?: string | null
        self_completed_by_role?: string | null
        complaints: any[]
    }[]
    rc_complaints?: any[]
    // AFA rows live in their own table (afa_orders) — never carry the applicant's
    // full name or Ghana Card number here, only what the list is allowed to render.
    is_afa?: boolean
}

interface ShopFees {
    mtn: number
    telecel: number
    at: number
}

// The mirrored `orders` row (or its latest retry descendant, spliced into orders[0] in
// fetchOrders) is the source of truth for status — shop_orders.status only stays in sync
// with it for the ORIGINAL order, not across a retry. RC/voucher orders have no mirror,
// so they fall back to their own status field.
const effectiveStatus = (order: ShopOrder) => order.orders?.[0]?.status || order.status

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Pending', color: 'bg-brand-500/15 text-brand-700 dark:text-brand-500', icon: Clock },
    queued: { label: 'Queued', color: 'bg-brand-500/15 text-brand-700 dark:text-brand-500', icon: Hourglass },
    processing: { label: 'Processing', color: 'bg-brand-500/15 text-brand-700 dark:text-brand-500', icon: Clock },
    completed: { label: 'Delivered', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-500/15 text-red-600 dark:text-red-400', icon: XCircle },
    refunded: { label: 'Refunded', color: 'bg-foreground/10 text-muted-foreground', icon: AlertCircle },
    // afa_orders.status also includes 'cancelled' (no shop_orders/RC equivalent) —
    // without this entry it would silently fall through to the raw string label.
    cancelled: { label: 'Cancelled', color: 'bg-foreground/10 text-muted-foreground', icon: Ban },
}

const PILL = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold'
const ACTION_BTN = 'inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60'
const SELECT = 'well h-10 shrink-0 rounded-xl border-0 bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
const prettyStatus = (s: string) => s.replace(/_/g, ' ')

// Trimmed to exactly the columns this page reads from shop_orders_effective
// (see the order-card JSX and effectiveStatus/isRetryable below) instead of
// select('*') — smaller payload per page load.
const SHOP_ORDER_SELECT = 'id, guest_phone, network, package_size, selling_price, profit, status, created_at, package_id, source, effective_status, current_order_id, current_refunded_at, current_retry_count, current_retry_from_status, current_retry_of_order_id, current_retried_by_role, current_self_completed_at, current_self_completed_by_role'

interface ShopOrderStatsRow {
    total_count: number
    pending_count: number
    queued_count: number
    processing_count: number
    completed_count: number
    failed_count: number
    refunded_count: number
    revenue: number
    profit: number
}

interface VoucherStatsRow {
    total_count: number
    pending_count: number
    processing_count: number
    completed_count: number
    failed_count: number
    refunded_count: number
    revenue: number
    profit: number
}

export default function ShopOrdersPage() {
    const { dbUser } = useAuth()
    // Drops responses from superseded requests so fast filter/tab/page changes can't
    // let an older, slower query overwrite the list and stats of the newer one.
    const fetchSeq = useRef(0)

    // Data state
    const [orders, setOrdersState] = useState<ShopOrder[]>([])
    const [totalCount, setTotalCountState] = useState(0)
    const [page, setPage] = useState(1)
    const [shopId, setShopId] = useState<string | null>(null)
    const [initialLoading, setInitialLoadingState] = useState(true)
    const [loading, setLoadingState] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [fees, setFees] = useState<ShopFees>({ mtn: 0, telecel: 0, at: 0 })
    const [hasNoRcMargin, setHasNoRcMargin] = useState(false)
    const [activeTab, setActiveTab] = useState<'all' | 'data' | 'airtime' | 'vouchers' | 'afa' | 'utility'>('all')

    // Filter state
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterNetwork, setFilterNetwork] = useState<string>('all')
    // Source filter UI removed (storefront is the only sales channel); kept at 'all' for the query plumbing.
    const [filterSource] = useState<'all' | 'storefront' | 'ussd'>('all')
    const [filterDate, setFilterDate] = useState<'today' | '7d' | '30d' | 'all'>('today')
    const [utilityBillerFilter, setUtilityBillerFilter] = useState<'all' | UtilityBiller>('all')
    const [searchPhone, setSearchPhone] = useState('')
    const [debouncedSearchPhone, setDebouncedSearchPhone] = useState('')

    // Stats — computed server-side across the full filtered set (not just this page).
    const [stats, setStatsState] = useState({ total: 0, pending: 0, queued: 0, processing: 0, completed: 0, refunded: 0, revenue: 0, profit: 0 })

    // Complaint state
    const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null)
    const [complaintDescription, setComplaintDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Retry state — refunded storefront/USSD orders can be retried from the owner's
    // Capozy Wallet. Only data-bundle shop orders are retryable (RC/vouchers and airtime
    // have no matching data_packages row for retry pricing, so they're excluded below).
    const [retryTarget, setRetryTarget] = useState<ShopOrder | null>(null)
    const [retryBusy, setRetryBusy] = useState(false)

    // MoMo details modal state — shown only for failed/refunded, non-RC shop orders.
    const [momoOrderId, setMomoOrderId] = useState<string | null>(null)
    const [momoModalOpen, setMomoModalOpen] = useState(false)

    // Debounce the phone search before it drives a server query — search is now
    // server-side (ilike), so firing a request per keystroke would hammer the DB.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearchPhone(searchPhone.trim()), 350)
        return () => clearTimeout(t)
    }, [searchPhone])

    // One-time (per dbUser) shop profile + fees + RC margin lookup — kept separate
    // from the paginated orders fetch so paging/filtering doesn't redo it every time.
    useEffect(() => {
        if (!dbUser) return
        (async () => {
            const { data: shopData, error: shopErr } = await (supabase as any)
                .from('shop_profiles')
                .select('id, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at, results_checker_markup_customer')
                .eq('owner_id', dbUser.id)
                .maybeSingle()

            if (shopErr || !shopData) {
                setShopId(null)
                setInitialLoadingState(false)
                setLoadingState(false)
                return
            }

            setFees({
                mtn: shopData.airtime_fee_mtn || 0,
                telecel: shopData.airtime_fee_telecel || 0,
                at: shopData.airtime_fee_at || 0
            })

            // RC margin counts as "set" if EITHER the legacy single markup > 0 OR any
            // per-exam markup row > 0 (per-exam markups override the legacy field —
            // mirrors app/api/shop/results-checker/initialize/route.ts L179-193).
            const { data: rcMarkupRows } = await (supabase as any)
                .from('shop_rc_markups')
                .select('markup')
                .eq('shop_id', shopData.id)
            const legacyRcMarkup = parseFloat(String(shopData.results_checker_markup_customer ?? 0)) || 0
            const anyPerExamMarkup = (rcMarkupRows || []).some((r: any) => (parseFloat(String(r.markup)) || 0) > 0)
            setHasNoRcMargin(legacyRcMarkup <= 0 && !anyPerExamMarkup)

            setShopId(shopData.id)
        })()
    }, [dbUser])

    // Any filter/tab change resets to page 1 — paging stays meaningful only within a fixed filter set.
    useEffect(() => {
        setPage(1)
    }, [activeTab, filterStatus, filterNetwork, filterSource, filterDate, debouncedSearchPhone, utilityBillerFilter])

    useEffect(() => {
        if (!shopId) return
        fetchOrders(page)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId, page, activeTab, filterStatus, filterNetwork, filterSource, filterDate, debouncedSearchPhone, utilityBillerFilter])

    const getDateFrom = (): string | null => {
        const now = new Date()
        if (filterDate === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        if (filterDate === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        if (filterDate === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        return null // 'all'
    }

    const fetchOrders = async (pageNum: number = page) => {
        const seq = ++fetchSeq.current
        const guard = <T,>(fn: (v: T) => void) => (v: T) => { if (seq === fetchSeq.current) fn(v) }
        const setOrders = guard(setOrdersState)
        const setTotalCount = guard(setTotalCountState)
        const setLoading = guard(setLoadingState)
        const setInitialLoading = guard(setInitialLoadingState)
        const setStats = guard(setStatsState)
        if (!shopId) {
            setOrders([])
            setTotalCount(0)
            setLoading(false)
            setInitialLoading(false)
            return
        }

        setLoading(true)
        try {
            const dateFrom = getDateFrom()
            const search = debouncedSearchPhone ? escapeLikePattern(debouncedSearchPhone) : null
            const { from, to } = pageToRange(pageNum)

            if (activeTab === 'afa') {
                // AFA registrations live in their own table (afa_orders) — independent,
                // separately-paginated query, same pattern as the vouchers branch above.
                // Select only what this list is allowed to render: never full_name or
                // ghana_card (Ghana Card number) — the privacy guarantee for this feature.
                let afaQuery = (supabase as any)
                    .from('afa_orders')
                    .select('id, phone, selling_price, profit, status, created_at, reference_code', { count: 'exact' })
                    .eq('shop_id', shopId)

                if (filterStatus !== 'all') afaQuery = afaQuery.eq('status', filterStatus)
                if (dateFrom) afaQuery = afaQuery.gte('created_at', dateFrom)
                if (search) afaQuery = afaQuery.ilike('phone', `%${search}%`)

                const { data, error, count } = await afaQuery
                    .order('created_at', { ascending: false })
                    .range(from, to)

                if (error) throw error

                const mapped: ShopOrder[] = (data || []).map((o: any) => ({
                    id: o.id,
                    guest_phone: o.phone,
                    selling_price: o.selling_price || 0,
                    profit: o.profit || 0,
                    status: o.status,
                    created_at: o.created_at,
                    reference_code: o.reference_code,
                    is_afa: true,
                }))
                setOrders(mapped)
                setTotalCount(count || 0)

                // No dedicated stats RPC for AFA yet — pull the full filtered set
                // (unpaginated) and reduce client-side. AFA volume is expected to stay
                // low, unlike data/airtime/vouchers which have their own RPCs.
                let statsQuery = (supabase as any)
                    .from('afa_orders')
                    .select('status, selling_price, profit')
                    .eq('shop_id', shopId)
                if (filterStatus !== 'all') statsQuery = statsQuery.eq('status', filterStatus)
                if (dateFrom) statsQuery = statsQuery.gte('created_at', dateFrom)
                if (search) statsQuery = statsQuery.ilike('phone', `%${search}%`)
                const { data: statsRows } = await statsQuery
                const allRows: any[] = statsRows || []
                setStats({
                    total: allRows.length,
                    pending: allRows.filter(r => r.status === 'pending').length,
                    queued: 0,
                    processing: allRows.filter(r => r.status === 'processing').length,
                    completed: allRows.filter(r => r.status === 'completed').length,
                    refunded: 0,
                    revenue: allRows.reduce((s, r) => s + (r.selling_price || 0), 0),
                    profit: allRows.reduce((s, r) => s + (r.profit || 0), 0),
                })
            } else if (activeTab === 'utility') {
                // Utility bills (ECG/Ghana Water/DSTV/GOtv/StarTimes) live in their own
                // table with an owner-only RLS policy, and storefront utility orders always
                // insert user_id: null — so the browser-client RLS read never returns rows
                // for a shop owner. Read via the server route instead (service-role, scoped
                // to this shop's shop_id), which also computes stats over the SAME filtered
                // query used for the list.
                const params = new URLSearchParams()
                if (filterStatus !== 'all') params.set('status', filterStatus)
                if (utilityBillerFilter !== 'all') params.set('biller', utilityBillerFilter)
                if (filterSource !== 'all') params.set('source', filterSource)
                if (dateFrom) params.set('from', dateFrom)
                if (search) params.set('search', search)
                params.set('limit', String(ORDER_HISTORY_PAGE_SIZE))
                params.set('offset', String(from))

                const res = await fetch(`/api/shop/utility-orders?${params.toString()}`)
                const json = await res.json().catch(() => null)
                if (!json?.success) throw new Error(json?.error || 'Failed to load utility orders')

                const mapped: ShopOrder[] = (json.data.orders || []).map((o: any) => ({
                    id: o.id,
                    guest_phone: o.destination_phone || '',
                    type_name: o.account_name || o.account_number,
                    selling_price: Number(o.amount),
                    profit: Number(o.partner_commission_amount) || 0,
                    status: o.status,
                    created_at: o.created_at,
                    is_utility: true,
                    biller: o.biller,
                    source: o.source,
                }))
                setOrders(mapped)
                setTotalCount(json.data.total || 0)
                setStats(json.data.stats) // full replace — matches both sibling branches,
                // fixes the "stale stats bleed across tabs" defect (previously a partial spread).
                setLoading(false)
                setInitialLoading(false) // the shared `finally` block below is skipped by this
                // early return, so this must be set here explicitly to match its end state.
                return
            } else if (activeTab === 'vouchers') {
                // Vouchers (results checker) live in their own table — a separate,
                // independently paginated query, not merged with data/airtime.
                let rcQuery = (supabase as any)
                    .from('results_checker_orders')
                    .select('id, customer_phone, type_name, quantity, unit_price, shop_markup, status, created_at, results_checker_complaints(id, status)', { count: 'exact' })
                    .eq('shop_id', shopId)
                    .neq('payment_status', 'pending_payment')

                if (filterStatus !== 'all') rcQuery = rcQuery.eq('status', filterStatus)
                if (dateFrom) rcQuery = rcQuery.gte('created_at', dateFrom)
                if (search) rcQuery = rcQuery.ilike('customer_phone', `%${search}%`)

                const { data, error, count } = await rcQuery
                    .order('created_at', { ascending: false })
                    .range(from, to)

                if (error) throw error

                const mapped: ShopOrder[] = (data || []).map((o: any) => ({
                    id: o.id,
                    guest_phone: o.customer_phone,
                    type_name: o.type_name,
                    quantity: o.quantity,
                    selling_price: o.unit_price * o.quantity,
                    profit: o.shop_markup * o.quantity,
                    status: o.status,
                    created_at: o.created_at,
                    is_rc: true,
                    rc_complaints: o.results_checker_complaints || [],
                }))
                setOrders(mapped)
                setTotalCount(count || 0)

                const { data: statsRow, error: statsErr } = await (supabase as any)
                    .rpc('get_shop_voucher_stats', {
                        p_shop_id: shopId,
                        p_status: filterStatus === 'all' ? null : filterStatus,
                        p_search: search,
                        p_date_from: dateFrom,
                    })
                    .maybeSingle()

                if (!statsErr && statsRow) {
                    const s = statsRow as VoucherStatsRow
                    setStats({
                        total: Number(s.total_count) || 0,
                        pending: Number(s.pending_count) || 0,
                        queued: 0,
                        processing: Number(s.processing_count) || 0,
                        completed: Number(s.completed_count) || 0,
                        refunded: Number(s.refunded_count) || 0,
                        revenue: Number(s.revenue) || 0,
                        profit: Number(s.profit) || 0,
                    })
                }
            } else {
                // "All" = data + airtime only (vouchers have their own tab/table above) —
                // keeps every tab's pagination scoped to a single table.
                let query = (supabase as any)
                    .from('shop_orders_effective')
                    .select(SHOP_ORDER_SELECT, { count: 'exact' })
                    .eq('shop_id', shopId)

                if (activeTab === 'data') query = query.not('package_id', 'is', null)
                if (activeTab === 'airtime') query = query.is('package_id', null)
                if (filterStatus !== 'all') query = query.eq('effective_status', filterStatus)
                if (filterNetwork !== 'all') query = query.ilike('network', filterNetwork)
                if (filterSource === 'storefront') query = query.or('source.is.null,source.not.in.(ussd,ussd_shop)')
                if (filterSource === 'ussd') query = query.in('source', ['ussd', 'ussd_shop'])
                if (dateFrom) query = query.gte('created_at', dateFrom)
                if (search) query = query.ilike('guest_phone', `%${search}%`)

                const { data, error, count } = await query
                    .order('created_at', { ascending: false })
                    .range(from, to)

                if (error) throw error

                const rows = data || []

                // Complaints for the CURRENT order in each row's retry chain (mirror or
                // latest retry descendant) — a small follow-up query scoped to just this
                // page's ~20 rows, since shop_orders_effective is a view and PostgREST
                // can't reliably embed a relationship through it.
                const currentOrderIds = rows.map((o: any) => o.current_order_id).filter(Boolean)
                const complaintsByOrderId = new Map<string, any[]>()
                if (currentOrderIds.length > 0) {
                    const { data: complaintRows } = await (supabase as any)
                        .from('complaints')
                        .select('id, order_id, status')
                        .in('order_id', currentOrderIds)
                    for (const c of complaintRows || []) {
                        const arr = complaintsByOrderId.get(c.order_id) || []
                        arr.push(c)
                        complaintsByOrderId.set(c.order_id, arr)
                    }
                }

                const mapped: ShopOrder[] = rows.map((o: any) => ({
                    id: o.id,
                    guest_phone: o.guest_phone,
                    network: o.network,
                    package_size: o.package_size,
                    selling_price: o.selling_price,
                    profit: o.profit,
                    status: o.status,
                    created_at: o.created_at,
                    package_id: o.package_id,
                    source: o.source,
                    orders: o.current_order_id ? [{
                        id: o.current_order_id,
                        status: o.effective_status,
                        refunded_at: o.current_refunded_at,
                        retry_count: o.current_retry_count,
                        retry_from_status: o.current_retry_from_status,
                        retry_of_order_id: o.current_retry_of_order_id,
                        retried_by_role: o.current_retried_by_role,
                        self_completed_at: o.current_self_completed_at,
                        self_completed_by_role: o.current_self_completed_by_role,
                        complaints: complaintsByOrderId.get(o.current_order_id) || [],
                    }] : [],
                }))

                setOrders(mapped)
                setTotalCount(count || 0)

                const { data: statsRow, error: statsErr } = await (supabase as any)
                    .rpc('get_shop_orders_stats', {
                        p_shop_id: shopId,
                        p_tab: activeTab,
                        p_status: filterStatus === 'all' ? null : filterStatus,
                        p_network: filterNetwork === 'all' ? null : filterNetwork,
                        p_source: filterSource === 'all' ? null : filterSource,
                        p_search: search,
                        p_date_from: dateFrom,
                    })
                    .maybeSingle()

                if (!statsErr && statsRow) {
                    const s = statsRow as ShopOrderStatsRow
                    setStats({
                        total: Number(s.total_count) || 0,
                        pending: Number(s.pending_count) || 0,
                        queued: Number(s.queued_count) || 0,
                        processing: Number(s.processing_count) || 0,
                        completed: Number(s.completed_count) || 0,
                        refunded: Number(s.refunded_count) || 0,
                        revenue: Number(s.revenue) || 0,
                        profit: Number(s.profit) || 0,
                    })
                }
            }
        } catch (err) {
            console.error('Error fetching orders:', err)
            if (seq === fetchSeq.current) toast.error('Could not load your orders. Check your connection and try again.')
            setOrders([])
            setTotalCount(0)
            setStats({ total: 0, pending: 0, queued: 0, processing: 0, completed: 0, refunded: 0, revenue: 0, profit: 0 })
        } finally {
            setLoading(false)
            setInitialLoading(false)
        }
    }

    const submitComplaint = async () => {
        if (!selectedOrder || !complaintDescription) return

        setIsSubmitting(true)
        try {
            // First, find the mirrored order ID
            const { data: mirror, error: mirrorErr } = await (supabase as any)
                .from('orders')
                .select('id, reference_code')
                .eq('shop_order_id', selectedOrder.id)
                .maybeSingle()

            if (mirrorErr || !mirror) {
                throw new Error('Could not find linked order record')
            }

            const response = await fetch('/api/complaints/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: mirror.id,
                    title: `[Shop: ${dbUser?.first_name}] Issue with order ${mirror.reference_code}`,
                    description: complaintDescription,
                    priority: 'medium',
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to submit complaint')
            }

            const { complaint: newComplaint } = await response.json()

            toast.success('Complaint submitted successfully')

            // Optimistic Update: Add the complaint to the local state
            // Keep the mirror's status/retry fields — replacing the whole entry made the
            // row's status fall back to the stale shop_orders status until the next refetch.
            setOrdersState(prevOrders => prevOrders.map(o => {
                if (o.id === selectedOrder.id) {
                    const current = o.orders?.[0]
                    return {
                        ...o,
                        orders: [{
                            ...(current ?? {}),
                            id: mirror.id,
                            complaints: [newComplaint]
                        }]
                    }
                }
                return o
            }))

            setSelectedOrder(null)
            setComplaintDescription('')
        } catch (error: any) {
            console.error('Complaint submission error:', error)
            toast.error(error.message || 'Failed to submit complaint')
        } finally {
            setIsSubmitting(false)
        }
    }

    const isWithin48Hours = (createdAt: string) => {
        const orderDate = new Date(createdAt)
        const now = new Date()
        return differenceInHours(now, orderDate) < 48
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await fetchOrders()
        setIsRefreshing(false)
        toast.success('Orders updated')
    }

    // A shop order is retryable when it's a data bundle (not RC/voucher, not airtime —
    // retry pricing needs a network+size match against data_packages), has a mirrored
    // `orders` row (source of truth for status), and that mirror is refunded.
    const isRetryable = (order: ShopOrder) => {
        if (order.is_rc) return false
        if (order.package_id == null) return false
        const mirror = order.orders?.[0]
        return !!mirror?.id && mirror.status === 'refunded'
    }

    const handleRetry = (order: ShopOrder) => {
        setRetryTarget(order)
    }

    const submitRetry = async () => {
        const mirrorOrderId = retryTarget?.orders?.[0]?.id
        if (!retryTarget || !mirrorOrderId || retryBusy) return
        setRetryBusy(true)
        try {
            const response = await fetch('/api/orders/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: mirrorOrderId }),
            })
            const result = await response.json().catch(() => ({}))

            if (!response.ok || !result?.success) {
                const outcome = result?.outcome as string | undefined
                const retryAfterSeconds = result?.retryAfter
                    ? Math.max(0, Math.ceil((new Date(result.retryAfter).getTime() - Date.now()) / 1000))
                    : null
                const messages: Record<string, string> = {
                    insufficient_balance: `Insufficient wallet balance to fund this retry${result?.required != null && result?.available != null
                        ? ` — needs GHS ${Number(result.required).toFixed(2)}, wallet has GHS ${Number(result.available).toFixed(2)}`
                        : ''
                        }.`,
                    retry_locked: `This order is locked from further retries${result?.until ? ` — try again after ${new Date(result.until).toLocaleString()}` : ', try again later'
                        }.`,
                    retry_too_soon: `Please wait a bit before retrying this order again${retryAfterSeconds != null ? ` (try again in ${retryAfterSeconds}s)` : ''}.`,
                    paystack_refund_no_wallet: 'This order was refunded via Paystack — there is no wallet to charge for a retry.',
                    not_retryable: result?.currentStatus ? `This order is currently "${result.currentStatus}" and can't be retried.` : 'This order is not in a retryable state.',
                    not_owner: result?.error || 'You are not authorized to retry this order.',
                    duplicate_attempt: 'This retry was already submitted — please refresh and check the order status before trying again.',
                    retry_already_in_progress: 'A previous retry for this order already succeeded or is in progress — refresh to see its current status.',
                    owner_not_found: 'Could not find the shop owner to fund this retry. Contact support.',
                    no_wallet_user: 'This order has no wallet to charge for a retry. Contact support.',
                    invalid_charge_amount: 'Could not determine a valid retry price for this order. Contact support.',
                }
                throw new Error((outcome && messages[outcome]) || result?.error || 'Failed to retry order')
            }

            const data = result.data
            toast.success(
                data?.message ||
                (data?.chargedAmount != null ? `Retry dispatched — GHS ${Number(data.chargedAmount).toFixed(2)} charged from your wallet` : 'Order retry dispatched')
            )
            setRetryTarget(null)
            fetchOrders()
        } catch (error: any) {
            console.error('Shop retry error:', error)
            toast.error(error?.message || 'Failed to retry order')
        } finally {
            setRetryBusy(false)
        }
    }

    // Self-service "Confirm Received" is scoped to data-bundle shop orders only, same
    // as isRetryable above — RC/voucher rows (order.is_rc) and airtime rows
    // (package_id == null) are excluded even though airtime orders DO have a mirrored
    // `orders` row (shop_orders_effective left-joins it for every shop_orders row, not
    // just data bundles) whose status could otherwise satisfy isConfirmReceivedEligible.
    const isShopConfirmReceivedEligible = (order: ShopOrder) => {
        if (order.is_rc) return false
        if (order.package_id == null) return false
        const mirror = order.orders?.[0]
        return isConfirmReceivedEligible({ status: mirror?.status || order.status })
    }

    // Confirm-received state — mirrors the retry state/handler pair above. The order id
    // is read from the mirror row (order.orders?.[0]?.id), same as submitRetry's
    // mirrorOrderId, since this page's rows are ShopOrder wrappers and the shop owner is
    // often not orders.user_id (the USSD/guest caller is) — ownership for shop owners is
    // resolved server-side in claim_self_order_complete via shop_order_id -> shop_id -> owner_id.
    const [confirmTarget, setConfirmTarget] = useState<ShopOrder | null>(null)
    const [confirmBusy, setConfirmBusy] = useState(false)

    const handleConfirmReceived = (order: ShopOrder) => {
        setConfirmTarget(order)
    }

    const submitConfirmReceived = async () => {
        const mirrorOrderId = confirmTarget?.orders?.[0]?.id
        if (!confirmTarget || !mirrorOrderId || confirmBusy) return
        setConfirmBusy(true)
        try {
            const response = await fetch('/api/orders/confirm-received', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: mirrorOrderId }),
            })
            const result = await response.json().catch(() => ({}))
            if (!response.ok || !result?.success) {
                const messages: Record<string, string> = {
                    not_eligible: result?.currentStatus
                        ? `This order is currently "${result.currentStatus}" and can't be confirmed received.`
                        : 'This order is not eligible to be marked complete.',
                    not_owner: result?.error || 'You are not authorized to confirm this order.',
                    order_not_found: 'Order not found — it may have already been updated. Please refresh.',
                }
                const outcome = result?.outcome as string | undefined
                throw new Error((outcome && messages[outcome]) || result?.error || 'Failed to confirm order received')
            }
            toast.success(result?.data?.outcome === 'already_completed'
                ? 'This order was already marked complete'
                : 'Order marked as completed — thanks for confirming!')
            setConfirmTarget(null)
            fetchOrders()
        } catch (error: any) {
            console.error('Shop confirm received error:', error)
            toast.error(error?.message || 'Failed to confirm order received')
        } finally {
            setConfirmBusy(false)
        }
    }

    const hasNoAirtimeFees = fees.mtn === 0 && fees.telecel === 0 && fees.at === 0

    // One label/icon source for every layout, so a row can never read differently on
    // phone and desktop (mashup bundles used to show as "Airtime" on phones).
    const describeOrder = (order: ShopOrder): { icon: React.ReactNode; label: string } => {
        const ic = 'h-3.5 w-3.5 flex-shrink-0 text-brand-700 dark:text-brand-500'
        if (order.is_utility) return { icon: <Coins className={ic} />, label: `${order.biller ? (UTILITY_BILLERS[order.biller]?.label ?? order.biller) : 'Utility'} · ${order.type_name ?? ''}` }
        if (order.is_rc) return { icon: <FileText className={ic} />, label: `${order.quantity}x ${order.type_name}` }
        if (order.is_afa) return { icon: <IdCard className={ic} />, label: 'AFA registration' }
        if (order.package_id == null && isMashupOrder(order.package_size)) return { icon: <Zap className={ic} />, label: 'MTN Mashup bundle' }
        if (order.package_id == null) return { icon: <RefreshCcw className={ic} />, label: `${order.network ?? ''} airtime` }
        return { icon: <ShoppingCart className={ic} />, label: `${order.network} ${order.package_size}` }
    }

    const TABS = [
        { id: 'all', label: 'All', icon: TrendingUp },
        { id: 'data', label: 'Data', icon: ShoppingCart },
        { id: 'airtime', label: 'Airtime', icon: RefreshCcw },
        { id: 'vouchers', label: 'Vouchers', icon: FileText },
        { id: 'afa', label: 'AFA', icon: IdCard },
        { id: 'utility', label: 'Bills', icon: Coins },
    ] as const

    if (initialLoading) {
        return (
            <div className="space-y-5" aria-busy="true" aria-label="Loading your orders">
                <div className="neu-raised-sm h-20 rounded-3xl" />
                <div className="neu-raised-sm h-14 rounded-2xl" />
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                    {[0, 1, 2, 3].map(i => <div key={i} className="neu-raised-sm h-20 rounded-2xl" />)}
                </div>
                <div className="neu-raised-sm h-96 rounded-3xl" />
            </div>
        )
    }

    const profitLabel = (activeTab === 'vouchers' || activeTab === 'utility') ? 'Commission' : 'Profit'
    const statTiles = [
        { label: 'Orders', value: String(stats.total), icon: ShoppingCart, tone: 'text-brand-700 dark:text-brand-500' },
        { label: 'In progress', value: String(stats.pending + stats.queued + stats.processing), icon: Clock, tone: 'text-brand-700 dark:text-brand-500' },
        { label: 'Delivered', value: String(stats.completed), icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Refunded', value: String(stats.refunded), icon: AlertCircle, tone: 'text-muted-foreground' },
        { label: 'Sales', value: formatCurrency(stats.revenue), icon: TrendingUp, tone: 'text-brand-700 dark:text-brand-500' },
        { label: profitLabel, value: formatCurrency(stats.profit), icon: activeTab === 'vouchers' || activeTab === 'utility' ? Coins : TrendingUp, tone: 'text-emerald-600 dark:text-emerald-400' },
    ]

    return (
        <div className="space-y-5 pb-20 md:pb-6">
            <header className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Link
                        href="/dashboard/shop"
                        aria-label="Back to your shop"
                        className="neu-raised-sm neu-press flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="font-display text-2xl font-bold leading-tight">Orders</h1>
                        <p className="truncate text-sm text-muted-foreground">Everything your customers have bought from your shop.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={cn(ACTION_BTN, 'clay-silver h-11 flex-shrink-0 rounded-2xl px-4 text-sm')}
                >
                    <RefreshCcw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </header>

            {/* Tabs */}
            <div role="tablist" aria-label="Order type" className="neu-inset flex w-full gap-1 overflow-x-auto rounded-2xl p-1.5 sm:w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none',
                            activeTab === tab.id ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'airtime' && hasNoAirtimeFees && (
                <div className="neu-raised-sm flex flex-col items-start gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="neu-inset flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-brand-700 dark:text-brand-500"><AlertCircle className="h-5 w-5" /></span>
                        <div>
                            <h2 className="font-display text-sm font-semibold">You are not earning on airtime yet</h2>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Customers can still buy airtime from you, but with no fee set you keep nothing from these sales.</p>
                        </div>
                    </div>
                    <Link href="/dashboard/shop/pricing" className="clay-gold inline-flex h-10 flex-shrink-0 items-center rounded-xl px-4 text-xs font-bold">Set my airtime fees</Link>
                </div>
            )}

            {activeTab === 'vouchers' && hasNoRcMargin && (
                <div className="neu-raised-sm flex flex-col items-start gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="neu-inset flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-brand-700 dark:text-brand-500"><Coins className="h-5 w-5" /></span>
                        <div>
                            <h2 className="font-display text-sm font-semibold">You are not earning on vouchers yet</h2>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Customers can still buy results checker vouchers, but with no margin set you keep nothing from these sales.</p>
                        </div>
                    </div>
                    <Link href="/dashboard/shop/pricing" className="clay-gold inline-flex h-10 flex-shrink-0 items-center rounded-xl px-4 text-xs font-bold">Set my margin</Link>
                </div>
            )}

            {/* Filters */}
            <div className="neu-raised-sm space-y-3 rounded-3xl p-4">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Find an order by phone number"
                        title="Search by phone number"
                        aria-label="Search by phone number"
                        inputMode="tel"
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        className="well h-11 rounded-xl border-0 bg-transparent pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-0"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div role="group" aria-label="Time range" className="neu-inset flex rounded-xl p-1">
                        {([
                            { id: 'today', label: 'Today' },
                            { id: '7d', label: '7 days' },
                            { id: '30d', label: '30 days' },
                            { id: 'all', label: 'All time' },
                        ] as const).map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                aria-pressed={filterDate === f.id}
                                onClick={() => setFilterDate(f.id)}
                                className={cn(
                                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    filterDate === f.id ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'utility' ? (
                        <select
                            title="Filter by biller"
                            aria-label="Filter by biller"
                            className={SELECT}
                            value={utilityBillerFilter}
                            onChange={(e) => setUtilityBillerFilter(e.target.value as any)}
                        >
                            <option value="all">All billers</option>
                            {UTILITY_BILLER_KEYS.map((b) => (
                                <option key={b} value={b}>{UTILITY_BILLERS[b].label}</option>
                            ))}
                        </select>
                    ) : activeTab !== 'vouchers' && activeTab !== 'afa' && (
                        <select
                            title="Filter by network"
                            aria-label="Filter by network"
                            className={SELECT}
                            value={filterNetwork}
                            onChange={(e) => setFilterNetwork(e.target.value)}
                        >
                            <option value="all">All networks</option>
                            <option value="mtn">MTN</option>
                            <option value="telecel">Telecel</option>
                            <option value="at">AirtelTigo</option>
                        </select>
                    )}

                    <select
                        title="Filter by status"
                        aria-label="Filter by status"
                        className={SELECT}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">Any status</option>
                        <option value="pending">Pending</option>
                        {activeTab !== 'afa' && <option value="queued">Queued</option>}
                        <option value="processing">Processing</option>
                        <option value="completed">Delivered</option>
                        {activeTab === 'afa' ? (
                            <option value="cancelled">Cancelled</option>
                        ) : (
                            <>
                                <option value="failed">Failed</option>
                                <option value="refunded">Refunded</option>
                            </>
                        )}
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {statTiles.map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="neu-raised-sm rounded-2xl p-3.5">
                        <div className="mb-1 flex items-center gap-1.5">
                            <Icon className={cn('h-3.5 w-3.5', tone)} />
                            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                        </div>
                        <p className="truncate text-base font-bold tabular-nums">{value}</p>
                    </div>
                ))}
            </div>

            {/* Orders */}
            <section aria-label="Order history" className="neu-raised-sm rounded-3xl p-4 sm:p-5">
                <h2 className="font-display text-lg font-semibold">Order history</h2>

                {loading ? (
                    <div className="mt-3 space-y-3" aria-busy="true" aria-label="Loading orders">
                        {[0, 1, 2, 3].map(i => <div key={i} className="neu-inset h-16 rounded-2xl" />)}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl py-10 text-center">
                        <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground"><Inbox className="h-5 w-5" /></span>
                        <p className="text-sm font-medium">No orders match these filters</p>
                        <p className="text-xs text-muted-foreground">Try a longer time range or clear the search.</p>
                    </div>
                ) : (
                    <ul className="mt-3 divide-y divide-border">
                        {orders.map((order) => {
                            const displayStatus = effectiveStatus(order)
                            const st = statusConfig[displayStatus]
                            const StatusIcon = st?.icon || Clock
                            const { icon, label } = describeOrder(order)
                            const tag = getSelfCompletedTag(order.orders?.[0] || {}) || getRetryTag(order.orders?.[0] || {})
                            const orderComplaints = order.is_rc ? (order.rc_complaints || []) : (order.orders?.[0]?.complaints || [])
                            const canMomo = !order.is_rc && !order.is_afa && !order.is_utility && isMomoLookupEligible({ status: displayStatus })
                            const canComplain = displayStatus === 'completed' && !order.is_rc && !order.is_afa && !order.is_utility && isWithin48Hours(order.created_at)
                            const when = new Date(order.created_at)

                            return (
                                <li key={order.id} className="py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="flex items-center gap-2 text-sm font-semibold">
                                                {icon}
                                                <span className="truncate">{label}</span>
                                            </p>
                                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                                                {order.guest_phone} · {when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(order.selling_price)}</span>
                                            <span className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                {displayStatus === 'failed' || displayStatus === 'refunded' ? <span className="text-muted-foreground">No profit</span> : `+${formatCurrency(order.profit)}`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                        <span className={cn(PILL, st?.color || 'bg-foreground/10 text-muted-foreground')}>
                                            <StatusIcon className="h-3 w-3" />
                                            {st?.label || prettyStatus(displayStatus)}
                                        </span>
                                        {tag && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${tag.badge}`}>{tag.label}</span>}

                                        {orderComplaints.length > 0 ? (
                                            <span className={cn(PILL, 'neu-inset text-brand-700 dark:text-brand-500')}>
                                                <MessageSquare className="h-3 w-3" /> Complaint: {prettyStatus(String(orderComplaints[0].status ?? 'open'))}
                                            </span>
                                        ) : isRetryable(order) ? (
                                            <button type="button" onClick={() => handleRetry(order)} className={cn(ACTION_BTN, 'clay-gold h-8 px-3')}>
                                                <RefreshCw className="h-3.5 w-3.5" /> Retry order
                                            </button>
                                        ) : isShopConfirmReceivedEligible(order) ? (
                                            <button type="button" onClick={() => handleConfirmReceived(order)} className={cn(ACTION_BTN, 'clay-black h-8 px-3')}>
                                                <CheckCircle2 className="h-3.5 w-3.5" /> Customer got it
                                            </button>
                                        ) : canComplain ? (
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedOrder(order); setComplaintDescription('') }}
                                                className={cn(ACTION_BTN, 'neu-raised-sm neu-press h-8 px-3 text-foreground')}
                                            >
                                                <MessageSquare className="h-3.5 w-3.5" /> Report a problem
                                            </button>
                                        ) : null}

                                        {canMomo && (
                                            <button
                                                type="button"
                                                onClick={() => { setMomoOrderId(order.id); setMomoModalOpen(true) }}
                                                className={cn(ACTION_BTN, 'neu-raised-sm neu-press h-8 px-3 text-foreground')}
                                            >
                                                <Smartphone className="h-3.5 w-3.5" /> MoMo details
                                            </button>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>


            <PaginationControls
                page={page}
                pageSize={ORDER_HISTORY_PAGE_SIZE}
                totalCount={totalCount}
                onPageChange={setPage}
                loading={loading}
            />

            <MomoDetailsModal
                open={momoModalOpen}
                onOpenChange={setMomoModalOpen}
                fetchUrl={momoOrderId ? `/api/shop/orders/${momoOrderId}/momo-details` : null}
            />

            {/* Complaint Dialog */}
            <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-display">Report a problem</DialogTitle>
                        <DialogDescription>
                            Tell us what went wrong with the order to {selectedOrder?.guest_phone}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="neu-inset space-y-1 rounded-2xl p-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone</span>
                                <span className="font-mono">{selectedOrder?.guest_phone}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Order</span>
                                <span>{selectedOrder ? describeOrder(selectedOrder).label : ''}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Price</span>
                                <span>{formatCurrency(selectedOrder?.selling_price || 0)}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="complaint-description">What happened?</Label>
                            <Textarea
                                id="complaint-description"
                                placeholder="Describe the problem your customer is facing..."
                                value={complaintDescription}
                                onChange={(e) => setComplaintDescription(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                            Cancel
                        </Button>
                        <Button onClick={submitComplaint} disabled={isSubmitting || !complaintDescription.trim()} className="clay-gold font-bold">
                            {isSubmitting ? 'Sending…' : 'Send report'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Retry Confirm Dialog — charges the shop owner's Capozy Wallet, not the customer */}
            <Dialog open={!!retryTarget} onOpenChange={(o) => { if (!o && !retryBusy) setRetryTarget(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Retry order</DialogTitle>
                        <DialogDescription>
                            {retryTarget?.network} {retryTarget?.package_size} · {retryTarget?.guest_phone}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="neu-inset flex items-start gap-2 rounded-2xl p-3 text-sm text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>Today&apos;s cost price will be charged to your Capozy Wallet — this may differ from what you originally paid. You&apos;ll see the exact amount charged once the retry succeeds.</span>
                        </div>
                        <div className="neu-inset flex items-start gap-2 rounded-2xl p-3 text-sm text-brand-700 dark:text-brand-500">
                            <RefreshCw className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>For MTN numbers, we recommend waiting 24 hours after a failed order before retrying, so the number can be verified into the MTN UP2U account.</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRetryTarget(null)} disabled={retryBusy}>Cancel</Button>
                        <Button onClick={submitRetry} disabled={retryBusy} className="clay-gold font-bold">
                            {retryBusy ? 'Retrying…' : 'Confirm retry'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm-received dialog — controlled, iOS-PWA safe (no native confirm) */}
            <Dialog open={!!confirmTarget} onOpenChange={(o) => { if (!o && !confirmBusy) setConfirmTarget(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm order received?</DialogTitle>
                        <DialogDescription>
                            {confirmTarget?.network} {confirmTarget?.package_size} · {confirmTarget?.guest_phone}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground space-y-2">
                        <span>Did the customer confirm they received this order before marking it complete? This can&apos;t be undone.</span>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfirmTarget(null)} disabled={confirmBusy}>Cancel</Button>
                        <Button onClick={submitConfirmReceived} disabled={confirmBusy} className="clay-gold font-bold">
                            {confirmBusy ? 'Confirming…' : 'Yes, mark complete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
