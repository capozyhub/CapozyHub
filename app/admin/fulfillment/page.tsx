'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getStatusBadgeClass, shouldShowRefundOverlay, REFUND_OVERLAY_BADGE_CLASS, getRetryTag, isRetryEligible, getSelfCompletedTag } from '@/lib/order-status'
import { computeDateRange, type DateFilterId, DATE_FILTER_PRESETS } from '@/lib/admin-date-range'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Package,
    Activity,
    Server,
    Filter,
    RotateCcw,
    Clock,
    Search,
    Calendar as CalendarIcon,
    ChevronDown,
    Loader2,
    Smartphone,
    Wallet,
    ShieldAlert,
    Users as UsersIcon,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MAX_BULK_REFUND, MAX_BULK_RETRY } from '@/lib/refunds'
import { formatCurrency, cn } from '@/lib/utils'
import { MomoDetailsModal } from '@/components/shared/momo-details-modal'
import { isMomoLookupEligible } from '@/lib/momo-eligibility'
import { cardSurface, mutedSurface, sectionLabel, accent } from '@/app/admin/_components/dashboard-tokens'

interface Order {
    id: string
    created_at: string
    phone_number: string
    network: string
    size: string
    price: number
    status: string
    user_id: string
    shop_name?: string
    source?: string
    shop_order_id?: string | null
    retry_count?: number | null
    retry_from_status?: string | null
    retry_of_order_id?: string | null
    retried_by_role?: string | null
    self_completed_at?: string | null
    self_completed_by_role?: string | null
    users: {
        first_name: string
        last_name: string
        role: string
    }
    mtn_fulfillment_tracking: Array<{
        transaction_id: string | null
        api_response?: any
        retry_count?: number
    }>
}

interface FulfillmentSettings {
    is_global_enabled: boolean
}

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const PAGE_SIZE = 10

// Order channel (origin) — a clean 3-way partition for the Channel filter buttons.
// Actual filtering now happens server-side in /api/admin/fulfillment (see the `channel`
// query param); this type + list only drive the filter UI and state below.
type OrderChannel = 'web' | 'shop'
const CHANNELS: Array<{ key: 'all' | OrderChannel; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'web', label: 'Web' },
    { key: 'shop', label: 'Shop' },
]

export default function FulfillmentPage() {
    const { dbUser } = useAuth()

    // Data State
    const [orders, setOrders] = useState<Order[]>([])
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)
    const [isRefulfilling, setIsRefulfilling] = useState(false)

    // Filter State
    const [networkFilter, setNetworkFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')
    const [channelFilter, setChannelFilter] = useState<'all' | OrderChannel>('all') // server-side (origin) — sent to /api/admin/fulfillment
    const [dateFilter, setDateFilter] = useState<DateFilterId>('today')
    const [customDate, setCustomDate] = useState<string>('') // Changed to string for input date
    const [searchQuery, setSearchQuery] = useState('')

    // Pagination State (Disabled for total load)
    const [ordersCount, setOrdersCount] = useState(0)

    // Settings state
    const [settings, setSettings] = useState<FulfillmentSettings>({ is_global_enabled: true })
    const [isSavingSettings, setIsSavingSettings] = useState(false)

    // Realtime live indicator
    const [isLive, setIsLive] = useState(false)

    // Auto-Complete Cron state
    const [cronEnabled, setCronEnabled] = useState(false)
    const [cronThreshold, setCronThreshold] = useState(30)
    const [cronThresholdInput, setCronThresholdInput] = useState('30')
    const [isSavingCron, setIsSavingCron] = useState(false)

    // New Cron for Auto-Refulfill
    const [autoRefulfillEnabled, setAutoRefulfillEnabled] = useState(false)
    const [autoRefulfillThreshold, setAutoRefulfillThreshold] = useState(5)
    const [autoRefulfillThresholdInput, setAutoRefulfillThresholdInput] = useState('5')
    const [isSavingAutoRefulfill, setIsSavingAutoRefulfill] = useState(false)

    // Rexamart — Capozy's one data-bundle + AFA supplier.
    const [rexamartNetworks, setRexamartNetworks] = useState<Record<string, boolean>>(
        NETWORKS.reduce((acc, n) => ({ ...acc, [n]: false }), {})
    )
    const [rexamartAfaEnabled, setRexamartAfaEnabled] = useState(false)
    const [isSavingRexamart, setIsSavingRexamart] = useState(false)
    const [rexamartBalance, setRexamartBalance] = useState<{ balance: number; currency: string } | null>(null)
    const [isLoadingBalance, setIsLoadingBalance] = useState(false)
    const rexamartActiveCount = Object.values(rexamartNetworks).filter(Boolean).length + (rexamartAfaEnabled ? 1 : 0)

    // Beneficiary (MTN number) verification tool
    const [beneficiaryInput, setBeneficiaryInput] = useState('')
    const [beneficiaryResults, setBeneficiaryResults] = useState<Array<{ number: string; verified: boolean; status: string; message?: string }> | null>(null)
    const [isCheckingBeneficiaries, setIsCheckingBeneficiaries] = useState(false)

    // Disputes (Rexamart "not received" reports)
    const [disputes, setDisputes] = useState<Array<{ reportReference: string; orderId: string; productKind: string; disputeStatus: string; amount?: number; phoneNumber?: string; createdAt: string }>>([])
    const [isLoadingDisputes, setIsLoadingDisputes] = useState(false)
    const [disputeStatusFilter, setDisputeStatusFilter] = useState('')

    useEffect(() => {
        if (dbUser?.role === 'admin') {
            fetchSettings()
            fetchRexamartBalance()
            fetchDisputes()
        }
    }, [dbUser])

    // Reset when filters change
    useEffect(() => {
        fetchOrders(true)
    }, [networkFilter, statusFilter, channelFilter, dateFilter, customDate, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

    // Determine Date Range — delegates to lib/admin-date-range.ts so this page and
    // app/admin/ishare/page.tsx compute identical ranges from identical presets.
    const getDateRange = () => computeDateRange(dateFilter, customDate)

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('admin_settings')
                .select('key, value')
                .in('key', [
                    'auto_fulfillment_enabled',
                    'auto_complete_data_enabled',
                    'auto_complete_data_threshold_mins',
                    'auto_refulfill_enabled',
                    'auto_refulfill_threshold_mins',
                    'fulfillment_settings',
                    'rexamart_afa_enabled',
                ])

            const map = (data || []).reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            setSettings({ is_global_enabled: map.auto_fulfillment_enabled !== 'false' })

            const fulfillmentSettings = typeof map.fulfillment_settings === 'string'
                ? JSON.parse(map.fulfillment_settings)
                : (map.fulfillment_settings || {})
            const dbRexamartNetworks: Record<string, boolean> = fulfillmentSettings.rexamart_networks || {}
            setRexamartNetworks(NETWORKS.reduce((acc, n) => ({ ...acc, [n]: dbRexamartNetworks[n] === true }), {} as Record<string, boolean>))
            setRexamartAfaEnabled(map.rexamart_afa_enabled === 'true')

            // Cron settings
            const cronEnabledVal = map.auto_complete_data_enabled !== 'false' && map.auto_complete_data_enabled !== undefined
                ? map.auto_complete_data_enabled === 'true'
                : false
            const cronThresholdVal = parseInt(map.auto_complete_data_threshold_mins || '30', 10)
            setCronEnabled(cronEnabledVal)
            setCronThreshold(cronThresholdVal)
            setCronThresholdInput(String(cronThresholdVal))

            const autoRefulfillEnabledVal = map.auto_refulfill_enabled !== 'false' && map.auto_refulfill_enabled !== undefined
                ? map.auto_refulfill_enabled === 'true'
                : false
            const autoRefulfillThresholdVal = parseInt(map.auto_refulfill_threshold_mins || '5', 10)
            setAutoRefulfillEnabled(autoRefulfillEnabledVal)
            setAutoRefulfillThreshold(autoRefulfillThresholdVal)
            setAutoRefulfillThresholdInput(String(autoRefulfillThresholdVal))
        } catch (error) {
            console.error('Failed to fetch settings:', error)
        }
    }

    const saveCronSettings = async (enabled: boolean, thresholdMins: number) => {
        setIsSavingCron(true)
        try {
            const updates = [
                { key: 'auto_complete_data_enabled', value: String(enabled) },
                { key: 'auto_complete_data_threshold_mins', value: String(thresholdMins) },
            ]
            const { error } = await (supabase.from('admin_settings') as any).upsert(updates, { onConflict: 'key' })
            if (error) throw error
            setCronEnabled(enabled)
            setCronThreshold(thresholdMins)
            setCronThresholdInput(String(thresholdMins))
            toast.success('Auto-complete cron settings saved')
        } catch (error: any) {
            toast.error('Failed to save cron settings: ' + error.message)
        } finally {
            setIsSavingCron(false)
        }
    }

    const saveAutoRefulfillSettings = async (enabled: boolean, thresholdMins: number) => {
        setIsSavingAutoRefulfill(true)
        try {
            const updates = [
                { key: 'auto_refulfill_enabled', value: String(enabled) },
                { key: 'auto_refulfill_threshold_mins', value: String(thresholdMins) },
            ]
            const { error } = await (supabase.from('admin_settings') as any).upsert(updates, { onConflict: 'key' })
            if (error) throw error
            setAutoRefulfillEnabled(enabled)
            setAutoRefulfillThreshold(thresholdMins)
            setAutoRefulfillThresholdInput(String(thresholdMins))
            toast.success('Auto-refulfill cron settings saved')
        } catch (error: any) {
            toast.error('Failed to save cron settings: ' + error.message)
        } finally {
            setIsSavingAutoRefulfill(false)
        }
    }


    // Writes ONLY auto_fulfillment_enabled via the audited, allowlisted quick-toggle
    // route — deliberately NOT saveSettings, which
    // would also rewrite the whole fulfillment_settings blob from this page's local
    // snapshot and could clobber a concurrent toggleNetwork/RPC write on another page.
    const toggleGlobal = async () => {
        const next = !settings.is_global_enabled
        const prev = settings.is_global_enabled
        setIsSavingSettings(true)
        setSettings(s => ({ ...s, is_global_enabled: next })) // optimistic
        try {
            const res = await fetch('/api/admin/settings/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'auto_fulfillment_enabled', value: next }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body.error || 'Failed to update')
            toast.success(`Auto-Fulfillment ${next ? 'enabled' : 'disabled'}`)
        } catch (e: any) {
            setSettings(s => ({ ...s, is_global_enabled: prev })) // revert
            toast.error(e.message || 'Failed to update setting')
        } finally {
            setIsSavingSettings(false)
        }
    }

    // Writes rexamart_networks inside the shared fulfillment_settings blob. Direct
    // client upsert (same pattern this page already used for cron settings above) —
    // this is the only page that writes this key now that the per-supplier toggle RPC
    // (built for nine suppliers racing across two pages) no longer applies to one.
    const toggleRexamartNetwork = async (network: string) => {
        const next = { ...rexamartNetworks, [network]: !rexamartNetworks[network] }
        setIsSavingRexamart(true)
        setRexamartNetworks(next) // optimistic
        try {
            const { error } = await (supabase.from('admin_settings') as any).upsert({
                key: 'fulfillment_settings',
                value: JSON.stringify({ rexamart_networks: next }),
            }, { onConflict: 'key' })
            if (error) throw error
            toast.success(`Rexamart ${next[network] ? 'connected for' : 'disconnected from'} ${network}`)
        } catch (e: any) {
            setRexamartNetworks(rexamartNetworks) // revert
            toast.error('Failed to update Rexamart settings: ' + e.message)
        } finally {
            setIsSavingRexamart(false)
        }
    }

    const toggleRexamartAfa = async (next: boolean) => {
        setIsSavingRexamart(true)
        setRexamartAfaEnabled(next) // optimistic
        try {
            const { error } = await (supabase.from('admin_settings') as any).upsert({ key: 'rexamart_afa_enabled', value: String(next) }, { onConflict: 'key' })
            if (error) throw error
            toast.success(`Rexamart AFA dispatch ${next ? 'enabled' : 'disabled'}`)
        } catch (e: any) {
            setRexamartAfaEnabled(!next) // revert
            toast.error('Failed to update setting: ' + e.message)
        } finally {
            setIsSavingRexamart(false)
        }
    }

    const fetchRexamartBalance = async () => {
        setIsLoadingBalance(true)
        try {
            const res = await fetch('/api/admin/rexamart/balance')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch balance')
            setRexamartBalance({ balance: data.balance, currency: data.currency })
        } catch (e: any) {
            // Silent on first load (Rexamart may simply not be configured yet) — the
            // balance card itself shows "—" and the error only matters on an explicit refresh.
            setRexamartBalance(null)
        } finally {
            setIsLoadingBalance(false)
        }
    }

    const checkBeneficiaries = async () => {
        const numbers = beneficiaryInput.split(/[\s,]+/).map(n => n.trim()).filter(Boolean)
        if (numbers.length === 0) { toast.error('Paste at least one phone number'); return }
        if (numbers.length > 40) { toast.error('At most 40 numbers per check'); return }
        setIsCheckingBeneficiaries(true)
        setBeneficiaryResults(null)
        try {
            const res = await fetch('/api/admin/rexamart/beneficiary-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Check failed')
            setBeneficiaryResults(data.results || [])
        } catch (e: any) {
            toast.error(e.message || 'Beneficiary check failed')
        } finally {
            setIsCheckingBeneficiaries(false)
        }
    }

    const fetchDisputes = async (status = disputeStatusFilter) => {
        setIsLoadingDisputes(true)
        try {
            const url = status ? `/api/admin/rexamart/disputes?status=${encodeURIComponent(status)}` : '/api/admin/rexamart/disputes'
            const res = await fetch(url)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to load disputes')
            setDisputes(data.disputes || [])
        } catch (e: any) {
            setDisputes([])
        } finally {
            setIsLoadingDisputes(false)
        }
    }

    const fetchOrders = async (isNewFilter = false, silent = false) => {
        if (!silent) setIsLoadingOrders(true)
        try {
            const { start, end } = getDateRange()

            let url = `/api/admin/fulfillment?network=${networkFilter}&status=${statusFilter}&channel=${channelFilter}&limit=1000`
            if (start) url += `&startDate=${start.toISOString()}`
            if (end) url += `&endDate=${end.toISOString()}`
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`

            const response = await fetch(url)
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to fetch orders')
            }

            const data = await response.json()
            const fetchedOrders = data.orders || []
            setOrders(fetchedOrders)
            setOrdersCount(fetchedOrders.length)
            if (data.truncated && !silent) {
                toast.error('More orders match this filter than could be loaded at once — narrow the date range or status to see everything.')
            }
        } catch (error: any) {
            console.error('Fetch orders error:', error)
            if (!silent) toast.error('Failed to fetch orders: ' + error.message)
        } finally {
            if (!silent) setIsLoadingOrders(false)
        }
    }

    // Always-fresh ref so the realtime handler sees latest filters without re-subscribing
    const fetchOrdersRef = useRef<typeof fetchOrders>(fetchOrders)
    useEffect(() => { fetchOrdersRef.current = fetchOrders })

    // Debounce ref — collapses burst DB events into one fetch
    const liveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Realtime subscription — auto-updates orders and status without manual refresh
    useEffect(() => {
        const triggerLiveFetch = () => {
            if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current)
            liveDebounceRef.current = setTimeout(() => {
                fetchOrdersRef.current(false, true)
            }, 1000)
        }

        const channel = supabase
            .channel('fulfillment-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, triggerLiveFetch)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mtn_fulfillment_tracking' }, triggerLiveFetch)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mtn_fulfillment_tracking' }, triggerLiveFetch)
            .subscribe((status) => { setIsLive(status === 'SUBSCRIBED') })

        return () => { supabase.removeChannel(channel) }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Refresh when tab becomes visible or window regains focus
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') fetchOrdersRef.current(false, true)
        }
        const onFocus = () => fetchOrdersRef.current(false, true)
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', onFocus)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', onFocus)
        }
    }, [])


    // Bulk refund — capped at MAX_BULK_REFUND for safety, processed server-side sequentially
    // (idempotent per order). Controlled dialog (no native confirm — iOS-PWA safe).
    const [showBulkRefund, setShowBulkRefund] = useState(false)
    const [bulkRefundBusy, setBulkRefundBusy] = useState(false)

    const bulkRefund = async () => {
        const ids = Array.from(selectedOrders)
        if (ids.length === 0) { toast.error('No orders selected'); return }
        if (ids.length > MAX_BULK_REFUND) {
            toast.error(`Select at most ${MAX_BULK_REFUND} orders to refund at once`)
            return
        }
        setBulkRefundBusy(true)
        try {
            const response = await fetch('/api/admin/orders/bulk-refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // mechanism applies only to shop orders in the batch; data orders ignore it.
                body: JSON.stringify({ orderIds: ids, mechanism: 'owner_wallet', confirmProcessing: true }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data.error || 'Bulk refund failed')
            const s = data.data?.summary ?? { ok: 0, skipped: 0, failed: 0 }
            toast.success(`Refunded ${s.ok} · skipped ${s.skipped} · failed ${s.failed}`)
            setSelectedOrders(new Set())
            setShowBulkRefund(false)
            await fetchOrders(true)
        } catch (error: any) {
            toast.error(error.message || 'Bulk refund failed')
        } finally {
            setBulkRefundBusy(false)
        }
    }

    const bulkUpdateStatus = async (newStatus: 'completed' | 'failed' | 'processing' | 'pending') => {
        if (selectedOrders.size === 0) {
            toast.error('No orders selected')
            return
        }

        setIsUpdating(true)
        try {
            const orderIds = Array.from(selectedOrders)
            const response = await fetch('/api/admin/orders/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds, status: newStatus }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Update failed')

            toast.success(`${orderIds.length} order(s) marked as ${newStatus}`)
            setSelectedOrders(new Set())

            // Re-fetch current view
            await fetchOrders(true)
        } catch (error: any) {
            toast.error('Update failed: ' + error.message)
        } finally {
            setIsUpdating(false)
        }
    }

    const refulfillPending = async (useSelection = false) => {
        setIsRefulfilling(true)
        try {
            const payload = useSelection && selectedOrders.size > 0
                ? { orderIds: Array.from(selectedOrders) }
                : {}

            const response = await fetch('/api/admin/fulfillment/refulfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Refulfillment failed')

            toast.success(`Refulfillment complete: ${data.fulfilled} processing, ${data.skipped} skipped, ${data.failed} failed/reverted`)
            if (useSelection) setSelectedOrders(new Set())

            // Re-fetch current view
            await fetchOrders(true)
        } catch (error: any) {
            toast.error('Refulfillment failed: ' + error.message)
        } finally {
            setIsRefulfilling(false)
        }
    }

    // Retry — single-order and bulk. Both are issued via controlled dialogs (no native
    // confirm() — iOS-PWA safe), mirroring the refund/refulfill dialog patterns above.
    // Gated on order.status alone (failed/refunded) — never on order.user_id, since admins
    // may retry any order and shop orders' rightful retrier often isn't orders.user_id.
    const [retryTarget, setRetryTarget] = useState<Order | null>(null)
    const [retryBusy, setRetryBusy] = useState(false)
    const [showBulkRetry, setShowBulkRetry] = useState(false)
    const [bulkRetryBusy, setBulkRetryBusy] = useState(false)

    // MoMo details modal state — shown only for failed/refunded shop orders (shop_order_id set).
    const [momoOrderId, setMomoOrderId] = useState<string | null>(null)
    const [momoModalOpen, setMomoModalOpen] = useState(false)

    const retryOutcomeMessage = (result: any): string => {
        const outcome = result?.outcome as string | undefined
        const messages: Record<string, string> = {
            insufficient_balance: `Insufficient wallet balance to fund this retry${result?.required != null && result?.available != null
                    ? ` — needs GHS ${Number(result.required).toFixed(2)}, wallet has GHS ${Number(result.available).toFixed(2)}`
                    : ''
                }.`,
            retry_locked: `This order is locked from further retries after 3 attempts${result?.until ? ` — try again after ${new Date(result.until).toLocaleString()}` : ', try again later'
                }.`,
            retry_too_soon: 'Please wait a few seconds before retrying this order again.',
            paystack_refund_no_wallet: "This order was refunded via Paystack — there is no wallet to charge for a retry.",
            not_retryable: result?.error || result?.message || 'This order is not in a retryable state.',
            admin_only: result?.error || result?.message || 'Only an admin can retry a failed order.',
            not_owner: result?.error || result?.message || 'You are not authorized to retry this order.',
            duplicate_attempt: 'This retry was already submitted — refresh and check the order status before trying again.',
            retry_already_in_progress: 'A previous retry for this order already succeeded or is in progress — refresh to see its current status.',
            owner_not_found: 'Could not find the shop owner to fund this retry.',
            no_wallet_user: 'This order has no wallet to charge for a retry.',
            invalid_charge_amount: 'Could not determine a valid retry price for this order.',
            invalid_actor_role: 'You are not authorized to perform this action.',
        }
        return (outcome && messages[outcome]) || result?.error || result?.message || 'Failed to retry order'
    }

    const handleRetry = (order: Order) => setRetryTarget(order)

    const submitRetry = async () => {
        if (!retryTarget || retryBusy) return
        setRetryBusy(true)
        try {
            const response = await fetch('/api/admin/orders/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: retryTarget.id }),
            })
            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(retryOutcomeMessage(result))
            }

            const data = result.data
            toast.success(
                data?.message ||
                (data?.chargedAmount ? `Retry dispatched — GHS ${Number(data.chargedAmount).toFixed(2)} charged` : 'Order retry dispatched')
            )
            setRetryTarget(null)
            await fetchOrders(true)
        } catch (error: any) {
            toast.error(error.message || 'Failed to retry order')
        } finally {
            setRetryBusy(false)
        }
    }

    // Selection filtered to retry-eligible orders only — used to gate the "Retry Selected"
    // button and to build the confirm dialog's failed/refunded breakdown.
    const retryEligibleSelected = orders.filter(o => selectedOrders.has(o.id) && isRetryEligible(o))
    const retryEligibleFailedCount = retryEligibleSelected.filter(o => o.status === 'failed').length
    const retryEligibleRefundedCount = retryEligibleSelected.filter(o => o.status === 'refunded').length

    const bulkRetry = async () => {
        const ids = retryEligibleSelected.map(o => o.id)
        if (ids.length === 0) { toast.error('No failed/refunded orders selected'); return }
        if (ids.length > MAX_BULK_RETRY) {
            toast.error(`Select at most ${MAX_BULK_RETRY} failed/refunded orders to retry at once`)
            return
        }
        setBulkRetryBusy(true)
        try {
            const response = await fetch('/api/admin/orders/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: ids }),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data.error || 'Bulk retry failed')
            const s = data.data?.summary ?? { ok: 0, skipped: 0, failed: 0, total: ids.length }
            toast.success(`Retried ${s.ok} · skipped ${s.skipped} · failed ${s.failed}`)
            setSelectedOrders(new Set())
            setShowBulkRetry(false)
            await fetchOrders(true)
        } catch (error: any) {
            toast.error(error.message || 'Bulk retry failed')
        } finally {
            setBulkRetryBusy(false)
        }
    }

    // Channel filtering happens server-side (see fetchOrders' `channel` param).
    const visibleOrders = orders

    if (dbUser?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <Activity className="w-12 h-12 text-destructive mb-4" />
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground">Admin privileges required.</p>
            </div>
        )
    }

    return (
        <div className="px-2 py-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Fulfillment Center</h1>
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${isLive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                            {isLive ? 'Live' : 'Offline'}
                        </span>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground">Manage multi-network automated and manual order processing</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        onClick={() => refulfillPending(false)}
                        disabled={isRefulfilling || orders.filter(o => o.status === 'pending').length === 0}
                        className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold"
                    >
                        {isRefulfilling ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <RotateCcw className="w-4 h-4 mr-2" />
                        )}
                        Refulfill All Pending
                    </Button>
                    <Button onClick={() => fetchOrders(true)} disabled={isLoadingOrders} variant="outline" size="sm" className="h-9 md:h-10 text-xs md:text-sm">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <div className="flex items-center gap-2 bg-background border px-3 h-9 md:h-10 rounded-full shadow-sm">
                        <span className="text-[10px] md:text-xs font-semibold">Auto-Fulfillment</span>
                        <Switch checked={settings.is_global_enabled} onCheckedChange={toggleGlobal} disabled={isSavingSettings} className="scale-75 md:scale-90" />
                    </div>
                </div>
            </div>

            {/* Supplier status — reflects whatever's actually enabled in the Rexamart panel
                below, rather than being a separate thing to keep in sync. */}
            <Card className={cn(cardSurface, 'border-l-4', rexamartActiveCount > 0 ? 'border-l-emerald-500' : 'border-l-zinc-300 dark:border-l-zinc-700')}>
                <CardContent className="p-4 md:p-5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg shrink-0', rexamartActiveCount > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted')}>
                            <Server className={cn('w-4 h-4 md:w-5 md:h-5', rexamartActiveCount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
                        </div>
                        <div>
                            <p className="text-sm md:text-base font-bold text-foreground">
                                {rexamartActiveCount > 0 ? `Rexamart active — ${rexamartActiveCount} line${rexamartActiveCount > 1 ? 's' : ''} connected` : 'No active supplier'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {rexamartActiveCount > 0
                                    ? 'Orders on a connected network/product dispatch automatically.'
                                    : 'Orders wait here for manual fulfillment — connect Rexamart below, or mark orders Processing/Completed by hand.'}
                            </p>
                        </div>
                    </div>
                    <div className={mutedSurface + ' px-3 py-1.5 flex items-center gap-2'}>
                        <Wallet className="w-3.5 h-3.5" style={{ color: accent.yellow }} />
                        <span className="text-xs font-bold text-foreground">
                            {isLoadingBalance ? '…' : rexamartBalance ? `${rexamartBalance.currency} ${rexamartBalance.balance.toFixed(2)}` : '—'}
                        </span>
                        <button onClick={fetchRexamartBalance} disabled={isLoadingBalance} className="text-muted-foreground hover:text-foreground">
                            <RefreshCw className={cn('w-3 h-3', isLoadingBalance && 'animate-spin')} />
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Rexamart — connect per network + AFA, matching lib/rexamart-service.ts's
                network map exactly (AT-iShare/AT-BigTime are the names Capozy uses
                internally; Rexamart's own names are translated inside that file). */}
            <Card className={cardSurface}>
                <CardContent className="p-4 md:p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Server className="w-4 h-4" style={{ color: accent.yellow }} />
                        <p className={sectionLabel}>Rexamart — Delivery Automation</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                        {NETWORKS.map(net => (
                            <div key={net} className={cn(mutedSurface, 'p-3')}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-xs">{net}</span>
                                    <Button
                                        variant={rexamartNetworks[net] ? 'outline' : 'default'}
                                        size="sm"
                                        className="h-6 text-[10px] px-2"
                                        onClick={() => toggleRexamartNetwork(net)}
                                        disabled={isSavingRexamart}
                                    >
                                        {rexamartNetworks[net] ? 'Disconnect' : 'Connect'}
                                    </Button>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <div className={cn('w-1.5 h-1.5 rounded-full', rexamartNetworks[net] ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600')} />
                                    {rexamartNetworks[net] ? 'Active' : 'Off'}
                                </div>
                            </div>
                        ))}
                        <div className={cn(mutedSurface, 'p-3')}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-xs">AFA (Ghana Card)</span>
                                <Switch checked={rexamartAfaEnabled} onCheckedChange={toggleRexamartAfa} disabled={isSavingRexamart} className="scale-75" />
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <div className={cn('w-1.5 h-1.5 rounded-full', rexamartAfaEnabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600')} />
                                {rexamartAfaEnabled ? 'Active' : 'Off'}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Rexamart tools: free MTN beneficiary verification, and delivery disputes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                <Card className={cardSurface}>
                    <CardContent className="p-4 md:p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <UsersIcon className="w-4 h-4" style={{ color: accent.blue }} />
                            <p className={sectionLabel}>Verify MTN Beneficiaries</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-2">Free — paste up to 40 numbers (one per line, or comma-separated).</p>
                        <textarea
                            value={beneficiaryInput}
                            onChange={(e) => setBeneficiaryInput(e.target.value)}
                            placeholder={'0241234567\n0551234567'}
                            className="w-full h-20 text-xs font-mono rounded-md border border-input bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button size="sm" className="mt-2 h-8 text-xs" onClick={checkBeneficiaries} disabled={isCheckingBeneficiaries}>
                            {isCheckingBeneficiaries ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                            Check
                        </Button>
                        {beneficiaryResults && (
                            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                                {beneficiaryResults.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground">No results</p>
                                ) : beneficiaryResults.map(r => (
                                    <div key={r.number} className={cn(mutedSurface, 'px-2.5 py-1.5 flex items-center justify-between')}>
                                        <span className="font-mono text-xs">{r.number}</span>
                                        <span className={cn(
                                            'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                                            r.verified ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400'
                                        )}>
                                            {r.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className={cardSurface}>
                    <CardContent className="p-4 md:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" style={{ color: accent.rose }} />
                                <p className={sectionLabel}>Delivery Disputes</p>
                            </div>
                            <button onClick={() => fetchDisputes()} disabled={isLoadingDisputes} className="text-muted-foreground hover:text-foreground">
                                <RefreshCw className={cn('w-3.5 h-3.5', isLoadingDisputes && 'animate-spin')} />
                            </button>
                        </div>
                        <div className="flex gap-1.5 mb-2 flex-wrap">
                            {['', 'open', 'under_review', 'upheld', 'rejected'].map(s => (
                                <Button
                                    key={s || 'all'}
                                    variant={disputeStatusFilter === s ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => { setDisputeStatusFilter(s); fetchDisputes(s) }}
                                >
                                    {s === '' ? 'All' : s.replace(/_/g, ' ')}
                                </Button>
                            ))}
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {disputes.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground py-4 text-center">{isLoadingDisputes ? 'Loading…' : 'No disputes'}</p>
                            ) : disputes.map(d => (
                                <div key={d.reportReference} className={cn(mutedSurface, 'px-2.5 py-1.5 flex items-center justify-between gap-2')}>
                                    <span className="font-mono text-[10px] truncate">{d.reportReference}</span>
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                        {d.disputeStatus}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Cron Jobs */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* Auto-Complete Data Cron Card */}
                <Card className={cn(cardSurface, 'border-l-4 border-l-violet-500')}>
                    <CardContent className="p-3 md:p-5">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                    <div className={cn(mutedSurface, 'p-2 mt-0.5 shrink-0')}>
                                        <Clock className="w-4 h-4" style={{ color: accent.violet }} />
                                    </div>
                                    <div>
                                        <p className="text-xs md:text-sm font-semibold text-foreground leading-tight">Auto-Complete</p>
                                        <p className="text-[10px] text-muted-foreground hidden md:block mt-0.5">Marks processing orders older than threshold as completed.</p>
                                    </div>
                                </div>
                                <div className={cn('shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full', cronEnabled ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-muted text-muted-foreground')}>
                                    {cronEnabled ? `On·${cronThreshold}m` : 'Off'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Switch
                                    id="cron-enabled"
                                    checked={cronEnabled}
                                    onCheckedChange={(val) => saveCronSettings(val, cronThreshold)}
                                    disabled={isSavingCron}
                                    className="scale-90"
                                />
                                <Input
                                    id="cron-threshold"
                                    type="number"
                                    min={5}
                                    max={1440}
                                    value={cronThresholdInput}
                                    onChange={(e) => setCronThresholdInput(e.target.value)}
                                    className="w-14 md:w-20 h-7 text-xs font-medium"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] md:text-xs px-2"
                                    disabled={isSavingCron}
                                    onClick={() => {
                                        const val = parseInt(cronThresholdInput, 10)
                                        if (!isNaN(val) && val >= 5) saveCronSettings(cronEnabled, val)
                                        else toast.error('Threshold must be at least 5 minutes')
                                    }}
                                >
                                    {isSavingCron ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Auto-Refulfill Pending Cron Card */}
                <Card className={cn(cardSurface, 'border-l-4 border-l-amber-500')}>
                    <CardContent className="p-3 md:p-5">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                    <div className={cn(mutedSurface, 'p-2 mt-0.5 shrink-0')}>
                                        <RotateCcw className="w-4 h-4" style={{ color: accent.yellow }} />
                                    </div>
                                    <div>
                                        <p className="text-xs md:text-sm font-semibold text-foreground leading-tight">Auto-Refulfill</p>
                                        <p className="text-[10px] text-muted-foreground hidden md:block mt-0.5">Retries pending orders, skips within cooldown.</p>
                                    </div>
                                </div>
                                <div className={cn('shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full', autoRefulfillEnabled ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>
                                    {autoRefulfillEnabled ? `On·${autoRefulfillThreshold}m` : 'Off'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Switch
                                    id="auto-refulfill-enabled"
                                    checked={autoRefulfillEnabled}
                                    onCheckedChange={(val) => saveAutoRefulfillSettings(val, autoRefulfillThreshold)}
                                    disabled={isSavingAutoRefulfill}
                                    className="scale-90"
                                />
                                <Input
                                    id="auto-refulfill-threshold"
                                    type="number"
                                    min={1}
                                    max={1440}
                                    value={autoRefulfillThresholdInput}
                                    onChange={(e) => setAutoRefulfillThresholdInput(e.target.value)}
                                    className="w-14 md:w-20 h-7 text-xs font-medium"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] md:text-xs px-2"
                                    disabled={isSavingAutoRefulfill}
                                    onClick={() => {
                                        const val = parseInt(autoRefulfillThresholdInput, 10)
                                        if (!isNaN(val) && val >= 1) saveAutoRefulfillSettings(autoRefulfillEnabled, val)
                                        else toast.error('Cooldown must be at least 1 minute')
                                    }}
                                >
                                    {isSavingAutoRefulfill ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Column: Stats & Filters */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Filter className="w-4 h-4" /> Filters & Search
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search Beneficiary..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 text-xs h-8"
                                />
                            </div>

                            {/* Date Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Date Range</label>
                                <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                                    {DATE_FILTER_PRESETS.map(range => (
                                        <Button
                                            key={range.id}
                                            variant={dateFilter === range.id ? "default" : "outline"}
                                            size="sm"
                                            className="h-8 text-[11px] font-bold justify-start px-3"
                                            onClick={() => setDateFilter(range.id)}
                                        >
                                            <CalendarIcon className="w-3.5 h-3.5 mr-2 opacity-60" />
                                            {range.label}
                                        </Button>
                                    ))}
                                </div>
                                {dateFilter === 'custom' && (
                                    <div className="mt-2">
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="date"
                                                className="pl-8 h-8 text-xs w-full block"
                                                value={customDate}
                                                onChange={(e) => setCustomDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Status Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {['All', 'Pending', 'Queued', 'Processing', 'Completed', 'Failed', 'Refunded'].map(s => (
                                        <Button
                                            key={s}
                                            variant={statusFilter === (s === 'All' ? 'All' : s.toLowerCase()) ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 text-[10px] px-2.5"
                                            onClick={() => setStatusFilter(s === 'All' ? 'All' : s.toLowerCase())}
                                        >
                                            {s}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Channel (origin) Filter — client-side */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Channel</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {CHANNELS.map(c => (
                                        <Button
                                            key={c.key}
                                            variant={channelFilter === c.key ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 text-[10px] px-2.5"
                                            onClick={() => setChannelFilter(c.key)}
                                        >
                                            {c.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Network Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground">Network</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {['All', ...NETWORKS].map(n => (
                                        <Button
                                            key={n}
                                            variant={networkFilter === n ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 text-[10px] px-2.5"
                                            onClick={() => setNetworkFilter(n)}
                                        >
                                            {n}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Pending', value: visibleOrders.filter(o => o.status === 'pending').length, color: accent.yellow },
                                        { label: 'Queued', value: visibleOrders.filter(o => o.status === 'queued').length, color: accent.blue },
                                        { label: 'Processing', value: visibleOrders.filter(o => o.status === 'processing').length, color: accent.violet },
                                        { label: 'Completed', value: visibleOrders.filter(o => o.status === 'completed').length, color: accent.emerald },
                                        { label: 'Failed', value: visibleOrders.filter(o => o.status === 'failed').length, color: accent.red },
                                        { label: 'Refunded', value: visibleOrders.filter(o => o.status === 'refunded').length, color: accent.rose },
                                        { label: 'Selected', value: selectedOrders.size, color: accent.slate },
                                    ].map(stat => (
                                        <div key={stat.label} className={cn(mutedSurface, 'p-2 md:p-2.5')}>
                                            <p className="text-[9px] md:text-[10px] text-muted-foreground font-bold uppercase">{stat.label}</p>
                                            <p className="text-lg md:text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                                        </div>
                                    ))}
                                    <div className={cn(mutedSurface, 'p-2 md:p-2.5')}>
                                        <p className="text-[9px] md:text-[10px] text-muted-foreground font-bold uppercase">Total Cost</p>
                                        <p className="text-sm md:text-base font-bold truncate" style={{ color: accent.emerald }}>
                                            GHS {visibleOrders.reduce((acc, curr) => acc + (curr.price || 0), 0).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn(cardSurface, 'border-l-4')} style={{ borderLeftColor: accent.yellow }}>
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Server className="w-4 h-4" style={{ color: accent.yellow }} /> Tip
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 text-[11px] leading-relaxed text-muted-foreground">
                            Deliver manually, then mark each order Processing/Completed below to keep records accurate.
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Order List */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Bulk Actions Bar */}
                    {selectedOrders.size > 0 && (
                        <div className="sticky top-20 z-30 flex items-center justify-between bg-primary/10 dark:bg-primary/20 backdrop-blur-md border border-primary/20 p-2 md:p-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-4 flex-wrap gap-2 mx-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="default" className="rounded-full px-2 text-[10px]">{selectedOrders.size}</Badge>
                                <span className="text-[10px] md:text-xs font-bold uppercase">Selected</span>
                            </div>
                            <div className="flex gap-2 md:gap-3 flex-wrap justify-end">
                                <Button
                                    size="sm"
                                    onClick={() => refulfillPending(true)}
                                    className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold"
                                    disabled={isRefulfilling || isUpdating}
                                >
                                    {isRefulfilling ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                                    {isRefulfilling ? 'Refulfilling...' : 'Refulfill Pending'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => bulkUpdateStatus('pending')}
                                    className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold"
                                    disabled={isUpdating || isRefulfilling || orders.some(o => selectedOrders.has(o.id) && o.status === 'processing')}
                                    title={orders.some(o => selectedOrders.has(o.id) && o.status === 'processing') ? "Cannot revert processing orders to pending" : ""}
                                >
                                    <Clock className="w-3.5 h-3.5 mr-1.5" /> Pending
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('processing')} className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold" disabled={isUpdating || isRefulfilling}>
                                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reprocess
                                </Button>
                                <Button size="sm" onClick={() => bulkUpdateStatus('completed')} className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isUpdating || isRefulfilling}>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Complete
                                </Button>
                                <Button size="sm" onClick={() => bulkUpdateStatus('failed')} variant="destructive" className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold" disabled={isUpdating || isRefulfilling}>
                                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Fail
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setShowBulkRefund(true)} className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold" disabled={isUpdating || isRefulfilling}>
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refund
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setShowBulkRetry(true)}
                                    className="h-9 md:h-10 text-xs md:text-sm px-3 md:px-4 font-bold"
                                    disabled={isUpdating || isRefulfilling || retryEligibleSelected.length === 0}
                                    title={retryEligibleSelected.length === 0 ? 'Select at least one failed/refunded order' : ''}
                                >
                                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry Selected
                                </Button>
                            </div>
                        </div>
                    )}

                    <Card className={cn(cardSurface, 'shadow-md')}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle className="text-lg font-bold">Order History</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set())} disabled={selectedOrders.size === 0}>
                                    Clear
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedOrders(new Set(visibleOrders.map(o => o.id)))} disabled={visibleOrders.length === 0}>
                                    Select Page
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-1 md:px-6">
                            {visibleOrders.length === 0 && !isLoadingOrders ? (
                                <div className="text-center py-20 border-2 border-dashed rounded-xl m-2">
                                    <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                                    <h3 className="text-sm font-bold">No Records Found</h3>
                                    <p className="text-muted-foreground text-xs">Try adjusting your filters.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {visibleOrders.map(order => (
                                        <div
                                            key={order.id}
                                            onClick={() => {
                                                // If the user was dragging to select/copy text (phone number, etc.),
                                                // don't also toggle bulk-select on the resulting click.
                                                if (window.getSelection()?.toString()) return
                                                const next = new Set(selectedOrders)
                                                next.has(order.id) ? next.delete(order.id) : next.add(order.id)
                                                setSelectedOrders(next)
                                            }}
                                            className={cn(
                                                // flex-wrap is load-bearing on mobile: the View MoMo wrapper below is
                                                // `w-full` (100% of this row) and only renders for failed/refunded
                                                // orders. Without wrapping it claimed the whole row and crushed the
                                                // flex-1 grid beside it to near-zero, collapsing the labels and
                                                // wrapping text one character per line. On md+ the button is w-auto
                                                // and nowrap restores the original single-line layout.
                                                "group relative flex flex-wrap md:flex-nowrap items-center gap-3 p-3 border-2 rounded-xl transition-all duration-200 cursor-pointer",
                                                selectedOrders.has(order.id)
                                                    ? "bg-primary/10 border-primary shadow-md scale-[1.01]"
                                                    : "bg-card border-transparent hover:border-primary/20 hover:bg-accent/50"
                                            )}
                                        >
                                            <Checkbox
                                                checked={selectedOrders.has(order.id)}
                                                className="scale-110 pointer-events-none"
                                            />

                                            {/* min-w-0 lets this shrink below its content's intrinsic width, so a long
                                                purchaser/shop name truncates instead of forcing the row to overflow. */}
                                            <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-6 items-center gap-x-2 gap-y-3 md:gap-4 p-1">
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] md:text-[11px] uppercase font-medium text-muted-foreground">Beneficiary</p>
                                                    <p className="text-[13px] md:text-sm font-medium text-primary">{order.phone_number}</p>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] md:text-[11px] uppercase font-medium text-muted-foreground">Bundle</p>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <Badge variant="outline" className="text-[10px] px-1.5 font-black leading-none py-1 bg-secondary/50">{order.network}</Badge>
                                                        <span className="text-[13px] md:text-xs font-medium">{order.size}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] md:text-[11px] uppercase font-medium text-muted-foreground">Purchaser</p>
                                                    <div className="text-[11px] md:text-xs">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {/* Shop-attributed orders with no buyer account (USSD shop
                                                                guests) show the SHOP as the purchaser — 'N/A' hid who
                                                                the sale belonged to. */}
                                                            <p className="font-bold truncate max-w-[100px] md:max-w-full" title={order.users?.first_name ? `${order.users?.first_name} ${order.users?.last_name ?? ''}` : (order.shop_name ?? undefined)}>
                                                                {order.users?.first_name
                                                                    ? <>{order.users.first_name} {order.users.last_name || ''}</>
                                                                    : (order.shop_name || 'N/A')}
                                                            </p>
                                                            {order.source === 'api' && (
                                                                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-violet-100 text-violet-700 hover:bg-violet-100 border-violet-200">
                                                                    API
                                                                </Badge>
                                                            )}
                                                            {/* The Shop pill stays only when the name line is a real
                                                                user (website shop rows attribute users = the owner) —
                                                                otherwise it would duplicate the purchaser line. */}
                                                            {order.shop_name && order.users?.first_name && (
                                                                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-brand-100 text-brand-700 hover:bg-brand-100 border-brand-200">
                                                                    Shop: {order.shop_name}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-muted-foreground opacity-70 text-[10px] font-bold uppercase">
                                                            {order.users?.role || (order.shop_name ? 'Shop' : order.source?.startsWith('ussd') ? 'Guest' : 'User')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] md:text-[11px] uppercase font-medium text-muted-foreground">Status</p>
                                                    <div>
                                                        {(() => {
                                                            // "Background Queue Fulfillment Success" is a Hubtel processing sub-state
                                                            // (distinct from the new 'queued' registration status) — keep its yellow chip.
                                                            const isBgQueue = order.status === 'processing'
                                                                && order.mtn_fulfillment_tracking?.some((t: any) => t.api_response?.note === 'Background Queue Fulfillment Success')
                                                            const retryTag = getRetryTag(order)
                                                            const selfCompletedTag = getSelfCompletedTag(order)
                                                            return (
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    <span className={cn(
                                                                        "inline-flex items-center rounded-md text-[10px] md:text-[11px] font-medium uppercase tracking-wider h-5 px-2",
                                                                        isBgQueue
                                                                            ? "border border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
                                                                            : getStatusBadgeClass(order.status)
                                                                    )}>
                                                                        {isBgQueue ? 'Queued Processing' : order.status}
                                                                    </span>
                                                                    {shouldShowRefundOverlay(order) && (
                                                                        <span className={cn(
                                                                            "inline-flex items-center rounded-md text-[10px] md:text-[11px] font-medium uppercase tracking-wider h-5 px-2",
                                                                            REFUND_OVERLAY_BADGE_CLASS
                                                                        )}>
                                                                            Refunded
                                                                        </span>
                                                                    )}
                                                                    {selfCompletedTag ? (
                                                                        <span className={cn(
                                                                            "inline-flex items-center rounded-md text-[10px] font-medium tracking-wide h-5 px-2",
                                                                            selfCompletedTag.badge
                                                                        )}>
                                                                            {selfCompletedTag.label}
                                                                        </span>
                                                                    ) : retryTag && (
                                                                        <span className={cn(
                                                                            "inline-flex items-center rounded-md text-[10px] font-medium tracking-wide h-5 px-2",
                                                                            retryTag.badge
                                                                        )}>
                                                                            {retryTag.label}
                                                                        </span>
                                                                    )}
                                                                    {isRetryEligible(order) && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-5 px-2 text-[10px] font-bold"
                                                                            onClick={(e) => { e.stopPropagation(); handleRetry(order) }}
                                                                        >
                                                                            <RotateCcw className="w-3 h-3 mr-1" /> Retry
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] md:text-[11px] uppercase font-medium text-muted-foreground">Time</p>
                                                    <p className="text-[11px] md:text-[12px] font-bold opacity-80">
                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>
                                                <div className="hidden md:block space-y-0.5 text-right">
                                                    <p className="text-[11px] uppercase font-medium text-muted-foreground">Cost</p>
                                                    <p className="text-sm font-semibold text-primary">{formatCurrency(order.price)}</p>
                                                </div>
                                            </div>
                                            {order.shop_order_id && isMomoLookupEligible({ status: order.status }) && (
                                                <div className="w-full md:w-auto md:ml-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2.5 text-[11px] text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200 dark:border-purple-900"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setMomoOrderId(order.id)
                                                            setMomoModalOpen(true)
                                                        }}
                                                    >
                                                        <Smartphone className="w-3 h-3 mr-1" />
                                                        View MoMo
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Footer Info */}
                                    {orders.length > 0 && (
                                        <div className="pt-4 flex items-center justify-center">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                                Showing {visibleOrders.length} orders in this period
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bulk refund confirmation — controlled, capped, iOS-PWA safe */}
            <Dialog open={showBulkRefund} onOpenChange={(o) => { if (!o && !bulkRefundBusy) setShowBulkRefund(false) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Refund {selectedOrders.size} order(s)?</DialogTitle>
                        <DialogDescription>
                            Eligible orders (pending / processing / failed) are refunded; completed and already-refunded orders are skipped automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                        <p>• Data orders → the buyer&apos;s wallet is credited.</p>
                        <p>• Shop orders → the cost is credited to the shop owner&apos;s wallet.</p>
                        <p className="text-amber-600 dark:text-amber-400">• Some selected orders may be processing and already delivered — proceed only if you accept that risk.</p>
                        {selectedOrders.size > MAX_BULK_REFUND && (
                            <p className="text-red-600 font-medium">You can refund at most {MAX_BULK_REFUND} orders at once. Deselect some first.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowBulkRefund(false)} disabled={bulkRefundBusy}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={bulkRefund}
                            disabled={bulkRefundBusy || selectedOrders.size === 0 || selectedOrders.size > MAX_BULK_REFUND}
                        >
                            {bulkRefundBusy ? 'Processing…' : `Refund ${Math.min(selectedOrders.size, MAX_BULK_REFUND)} order(s)`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Single-order retry — controlled, iOS-PWA safe (no native confirm) */}
            <Dialog open={!!retryTarget} onOpenChange={(o) => { if (!o && !retryBusy) setRetryTarget(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Retry order</DialogTitle>
                        <DialogDescription>
                            {retryTarget?.phone_number ? `${retryTarget.phone_number} · ` : ''}Status: {retryTarget?.status}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {retryTarget?.status === 'refunded' ? (
                            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2.5">
                                <RefreshCw className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>This order was refunded — retrying will charge <b>today&apos;s price</b> to the {retryTarget?.shop_order_id ? "shop owner's" : "buyer's"} funding wallet. The exact amount charged will be confirmed after the retry succeeds.</span>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 text-sm text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-md p-2.5">
                                <RotateCcw className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>This order failed and was never refunded — retrying re-dispatches it at no charge.</span>
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                            Retry attempts used: <b>{retryTarget?.retry_count ?? 0} / 3</b>
                            {(retryTarget?.retry_count ?? 0) >= 3 ? ' — further retries are locked for 24h after the last attempt.' : ''}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRetryTarget(null)} disabled={retryBusy}>Cancel</Button>
                        <Button onClick={submitRetry} disabled={retryBusy}>
                            {retryBusy ? 'Retrying…' : 'Confirm retry'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk retry confirmation — controlled, capped, iOS-PWA safe. Selection is
                pre-filtered to failed/refunded orders (retryEligibleSelected) before this
                opens, so counts here reflect exactly what will be sent. */}
            <Dialog open={showBulkRetry} onOpenChange={(o) => { if (!o && !bulkRetryBusy) setShowBulkRetry(false) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Retry {retryEligibleSelected.length} order(s)?</DialogTitle>
                        <DialogDescription>
                            Only failed/refunded orders in your selection are included — other selected rows are ignored automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                        <p>• <b>{retryEligibleRefundedCount}</b> refunded order(s) — these <span className="text-amber-600 dark:text-amber-400 font-medium">WILL be charged</span> at today&apos;s price to their funding wallet (the buyer&apos;s, or the shop owner&apos;s for shop orders).</p>
                        <p>• <b>{retryEligibleFailedCount}</b> failed order(s) — no money moves, these are simply re-dispatched.</p>
                        <p>• Individual orders may still be skipped server-side for cooldown or attempt-cap reasons.</p>
                        {retryEligibleSelected.length > MAX_BULK_RETRY && (
                            <p className="text-red-600 font-medium">You can retry at most {MAX_BULK_RETRY} orders at once. Deselect some first.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowBulkRetry(false)} disabled={bulkRetryBusy}>Cancel</Button>
                        <Button
                            onClick={bulkRetry}
                            disabled={bulkRetryBusy || retryEligibleSelected.length === 0 || retryEligibleSelected.length > MAX_BULK_RETRY}
                        >
                            {bulkRetryBusy ? 'Processing…' : `Retry ${Math.min(retryEligibleSelected.length, MAX_BULK_RETRY)} order(s)`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MomoDetailsModal
                open={momoModalOpen}
                onOpenChange={setMomoModalOpen}
                fetchUrl={momoOrderId ? `/api/admin/orders/${momoOrderId}/momo-details` : null}
            />
        </div>
    )
}
