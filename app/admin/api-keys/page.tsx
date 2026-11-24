'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { toast } from '@/lib/toast'
import {
    Key, CheckCircle2, XCircle, Clock, User, Activity,
    Shield, Search, ChevronLeft, ChevronRight, RefreshCw,
    Sliders, Code2, BarChart2, AlertCircle, Check, X,
    TrendingUp, Zap, Settings, ToggleLeft, ToggleRight,
    Wallet, AlertOctagon, Gauge, Crown, Percent, ChevronDown,
    ChevronUp, ShoppingCart, Webhook,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateLimits {
    purchase: number
    bulk: number
    balance: number
    status: number
}

interface ApiKeyItem {
    id: string
    prefix: string
    name: string
    status: 'pending' | 'active' | 'revoked'
    key_type: 'standard'
    rate_limits: RateLimits | null
    last_used_at: string | null
    created_at: string
    requests_24h: number
    has_webhook: boolean
    user: {
        id: string
        name: string
        email: string
        phone: string
        role: string
    } | null
}

interface ApiLogItem {
    id: string
    endpoint: string
    method: string
    status_code: number
    response_time_ms: number
    ip_address: string | null
    error_message: string | null
    created_at: string
    api_key_id: string | null
    key_prefix?: string
    key_name?: string
    user?: { name: string; email: string } | null
}

// Matched on the path suffix (the same trick middleware.ts uses for its fail-closed set) so a
// developer-API request gets its friendly label instead of generic "API Request".
const ENDPOINT_LABELS: Record<string, string> = {
    '/data/purchase':  'Data purchase',
    '/data/bulk':      'Bulk purchase',
    '/wallet/balance': 'Balance check',
    '/wallet/topup':   'Wallet top-up',
    '/orders':         'Order status',
    '/airtime':        'Airtime',
    '/afa':            'AFA',
    '/resultschecker': 'Results checker',
}

function getFriendlyLabel(endpoint: string): string {
    const suffix = endpoint.replace(/^\/api/, '')
    for (const [key, label] of Object.entries(ENDPOINT_LABELS)) {
        if (suffix.startsWith(key)) return label
    }
    return 'Other request'
}

interface Pagination {
    page: number
    limit: number
    total: number
    total_pages: number
}

interface AggregateStats {
    requests_24h: number
    requests_ok_24h: number
    requests_err_24h: number
    success_rate_24h: number
    avg_response_ms: number
    revenue_24h: number
    revenue_all_time: number
    orders_24h: number
    top_user: { name: string; email: string; requests: number } | null
}

interface UserActivity {
    user_id: string
    total_spent: number
    total_orders: number
    success_orders: number
    failed_orders: number
    pending_orders: number
    success_rate: number
    requests_24h: number
    requests_ok_24h: number
    requests_err_24h: number
    avg_response_ms: number
}

type SortBy = 'recent' | 'requests' | 'last_used' | 'oldest'

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS = {
    pending: {
        icon: Clock,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200 dark:border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'Pending',
    },
    active: {
        icon: CheckCircle2,
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        border: 'border-emerald-200 dark:border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: 'Active',
    },
    revoked: {
        icon: XCircle,
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200 dark:border-red-500/30',
        dot: 'bg-red-400',
        label: 'Revoked',
    },
}

const DEFAULT_RATE_LIMITS: RateLimits = { purchase: 10, bulk: 3, balance: 5, status: 5 }

// ─── Stat Card ────────────────────────────────────────────────────────────────

type Accent = 'violet' | 'emerald' | 'red' | 'amber' | 'sky' | 'slate' | 'indigo'

function StatCard({
    icon: Icon, label, value, sub, accent = 'slate', pulse,
}: {
    icon?: any
    label: string
    value: number | string
    sub?: string
    accent?: Accent
    pulse?: boolean
}) {
    const accents: Record<Accent, { iconBg: string; iconText: string; text: string }> = {
        violet:  { iconBg: 'bg-brand-500/10',  iconText: 'text-brand-800 dark:text-brand-400',   text: 'text-brand-800 dark:text-brand-400' },
        emerald: { iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-700 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-400' },
        red:     { iconBg: 'bg-red-500/10',     iconText: 'text-red-600 dark:text-red-400',         text: 'text-red-600 dark:text-red-400' },
        amber:   { iconBg: 'bg-amber-500/10',   iconText: 'text-amber-600 dark:text-amber-400',     text: 'text-amber-500' },
        sky:     { iconBg: 'bg-brand-500/10',     iconText: 'text-brand-700 dark:text-brand-400',         text: 'text-brand-700 dark:text-brand-400' },
        indigo:  { iconBg: 'bg-brand-500/10',  iconText: 'text-brand-700 dark:text-brand-400',   text: 'text-brand-700 dark:text-brand-400' },
        slate:   { iconBg: 'bg-muted dark:bg-muted/60', iconText: 'text-muted-foreground ', text: 'text-foreground' },
    }
    const a = accents[accent]
    return (
        <div className="neu-raised-sm rounded-3xl p-3 sm:p-4 min-w-0">
            <div className="flex items-start gap-2 sm:gap-2.5">
                {Icon && (
                    <div className={cn('w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center flex-shrink-0', a.iconBg)}>
                        <Icon className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4', a.iconText)} />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                        <p className="text-xs font-semibold text-muted-foreground truncate">{label}</p>
                    </div>
                    <p className={cn('text-sm sm:text-base lg:text-lg font-semibold mt-0.5 tabular-nums whitespace-nowrap', a.text)}>{value}</p>
                    {sub && <p className="text-xs sm:text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
                </div>
            </div>
        </div>
    )
}

// ─── Rate Limit Editor ────────────────────────────────────────────────────────

function RateLimitEditor({
    keyId, current, onSaved,
}: {
    keyId: string; current: RateLimits | null; onSaved: () => void
}) {
    const [values, setValues] = useState<RateLimits>(current ?? DEFAULT_RATE_LIMITS)
    const [saving, setSaving] = useState(false)

    const field = (key: keyof RateLimits, label: string, hint: string) => (
        <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">{label}</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min={1}
                    max={1000}
                    title={label}
                    placeholder={label}
                    value={values[key]}
                    onChange={e => setValues(v => ({ ...v, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-20 px-3 py-1.5 rounded-lg text-sm font-mono text-foreground neu-inset border-0 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-brand-500"
                />
                <span className="text-xs text-muted-foreground">{hint}</span>
            </div>
        </div>
    )

    const save = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/api-keys', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_id: keyId, rate_limits: values }),
            })
            if (res.ok) { toast.success('Limits saved'); onSaved() }
            else { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Could not update the limits. Try again.') }
        } catch { toast.error('Could not reach the server. Check your connection and try again.') }
        finally { setSaving(false) }
    }

    return (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-brand-700 dark:text-brand-500" />
                <h4 className="text-sm font-semibold text-foreground">Rate limits for this key <span className="text-xs text-muted-foreground font-normal">(req / min)</span></h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {field('purchase', 'Purchase', 'req/min')}
                {field('bulk', 'Bulk', 'req/min')}
                {field('balance', 'Balance', 'req/min')}
                {field('status', 'Status', 'req/min')}
            </div>
            <div className="flex items-center gap-2 pt-1">
                <Button
                    size="sm"
                    onClick={save}
                    disabled={saving}
                    className="h-8 text-xs font-semibold clay-black gap-1.5"
                >
                    {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    {saving ? 'Saving…' : 'Save limits'}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setValues(DEFAULT_RATE_LIMITS)}
                    className="h-8 text-xs"
                >
                    Reset to defaults
                </Button>
            </div>
        </div>
    )
}

// ─── User Activity Panel ─────────────────────────────────────────────────────

function UserActivityPanel({ keyId, userId }: { keyId: string; userId: string }) {
    const [data, setData] = useState<UserActivity | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchActivity = async () => {
            try {
                const params = new URLSearchParams({ tab: 'user_activity', user_id: userId, api_key_id: keyId })
                const res = await fetch(`/api/admin/api-keys?${params}`)
                if (res.ok) setData(await res.json())
            } catch { /* noop */ }
            finally { setLoading(false) }
        }
        fetchActivity()
    }, [keyId, userId])

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 sm:h-20 rounded-xl" />)}
            </div>
        )
    }

    if (!data) {
        return <p className="text-xs text-muted-foreground">Could not load this user's activity. Close this panel and open it again to retry.</p>
    }

    const tile = (label: string, value: string | number, color = 'text-foreground') => (
        <div className="p-2.5 sm:p-3 min-w-0 neu-raised-sm rounded-3xl">
            <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground truncate">{label}</p>
            <p className={cn('text-sm sm:text-base font-semibold mt-0.5 tabular-nums whitespace-nowrap', color)}>{value}</p>
        </div>
    )

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {tile('Spent', `GH₵ ${data.total_spent.toFixed(2)}`, 'text-brand-800 dark:text-brand-400')}
            {tile('Orders', data.total_orders.toLocaleString())}
            {tile('Success', data.success_orders.toLocaleString(), 'text-emerald-700 dark:text-emerald-400')}
            {tile('Failed', data.failed_orders.toLocaleString(), 'text-red-600 dark:text-red-400')}
            {tile('Pending', data.pending_orders.toLocaleString(), 'text-amber-500')}
            {tile('Success rate', `${data.success_rate}%`,
                data.success_rate >= 90 ? 'text-emerald-700 dark:text-emerald-400'
                : data.success_rate >= 70 ? 'text-amber-500' : 'text-red-600 dark:text-red-400')}
            {tile('Requests (24h)', data.requests_24h.toLocaleString(), 'text-brand-700 dark:text-brand-400')}
            {tile('Average speed', `${data.avg_response_ms}ms`)}
        </div>
    )
}

// ─── Key Row ──────────────────────────────────────────────────────────────────

function KeyRow({ item, onAction }: {
    item: ApiKeyItem
    onAction: (id: string, action: 'approve' | 'revoke') => Promise<void>
}) {
    const [expanded, setExpanded] = useState<'limits' | 'activity' | null>(null)
    const [acting, setActing] = useState(false)
    const cfg = STATUS[item.status]
    const StatusIcon = cfg.icon

    const act = async (action: 'approve' | 'revoke') => {
        setActing(true)
        await onAction(item.id, action)
        setActing(false)
    }

    const toggle = (panel: 'limits' | 'activity') =>
        setExpanded(p => (p === panel ? null : panel))

    return (
        <div className="neu-raised-sm rounded-3xl overflow-hidden transition-shadow hover:shadow-sm">
            {/* Main row */}
            <div className="flex flex-col gap-3 p-3 sm:p-4 lg:p-5 lg:flex-row lg:items-center">

                {/* User avatar + info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate text-sm">{item.user?.name || 'Unknown user'}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.user?.email || '—'}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <code className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                                {item.prefix}••••••••
                            </code>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-md border bg-muted border-border text-muted-foreground">
                                <Key className="w-2.5 h-2.5" /> Standard
                            </span>
                            {item.has_webhook && (
                                <span
                                    title="This key has a webhook URL configured"
                                    className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-md border bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-400"
                                >
                                    <Webhook className="w-2.5 h-2.5" />
                                    Webhook
                                </span>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">{item.user?.role || '—'}</span>
                        </div>
                    </div>

                    {/* Status pill (mobile: stays with user info) */}
                    <div className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 lg:hidden',
                        cfg.bg, cfg.color, cfg.border
                    )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                        {cfg.label}
                    </div>
                </div>

                {/* Stats + status pill (desktop) */}
                <div className="hidden lg:flex items-center gap-4 flex-shrink-0 text-right">
                    <div>
                        <div className="flex items-center justify-end gap-1 text-sm font-semibold text-foreground/80">
                            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                            {item.requests_24h}
                            <span className="text-xs font-normal text-muted-foreground">req/24h</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {item.last_used_at
                                ? `Last: ${new Date(item.last_used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                                : 'Never used'}
                        </p>
                    </div>
                    <div className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                        cfg.bg, cfg.color, cfg.border
                    )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                    </div>
                </div>

                {/* Mobile stats row */}
                <div className="flex lg:hidden items-center justify-between text-xs px-0.5">
                    <span className="flex items-center gap-1 text-muted-foreground">
                        <Activity className="w-3 h-3" />
                        <span className="font-semibold text-foreground/80">{item.requests_24h}</span> req/24h
                    </span>
                    <span className="text-muted-foreground">
                        {item.last_used_at
                            ? `Last: ${new Date(item.last_used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                            : 'Never used'}
                    </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
                    {item.status === 'pending' && (
                        <Button
                            size="sm"
                            type="button"
                            onClick={() => act('approve')}
                            disabled={acting}
                            className="h-8 text-xs font-semibold gap-1.5 clay clay-green"
                        >
                            {acting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Approve
                        </Button>
                    )}
                    {item.status !== 'revoked' && (
                        <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => act('revoke')}
                            disabled={acting}
                            className="h-8 text-xs text-red-600 dark:text-red-400 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20"
                        >
                            {acting ? '…' : <><X className="w-3 h-3 mr-1" />Revoke</>}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => toggle('activity')}
                        className={cn('h-8 text-xs gap-1.5', expanded === 'activity' && 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-700 text-brand-800 dark:text-brand-400')}
                    >
                        <BarChart2 className="w-3 h-3" />
                        <span className="hidden sm:inline">Activity</span>
                        {expanded === 'activity' ? <ChevronUp className="w-3 h-3 sm:hidden" /> : <ChevronDown className="w-3 h-3 sm:hidden" />}
                    </Button>
                    <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => toggle('limits')}
                        className={cn('h-8 text-xs gap-1.5', expanded === 'limits' && 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-700 text-brand-800 dark:text-brand-400')}
                    >
                        <Sliders className="w-3 h-3" />
                        <span className="hidden sm:inline">Limits</span>
                    </Button>
                </div>
            </div>

            {/* Expanded: rate limit editor */}
            {expanded === 'limits' && (
                <div className="px-4 sm:px-5 pb-5 border-t border-border bg-muted/50 dark:bg-muted/20">
                    <RateLimitEditor keyId={item.id} current={item.rate_limits} onSaved={() => setExpanded(null)} />
                </div>
            )}

            {/* Expanded: user activity */}
            {expanded === 'activity' && item.user && (
                <div className="px-4 sm:px-5 py-4 sm:py-5 border-t border-border bg-muted/50 dark:bg-muted/20">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart2 className="w-4 h-4 text-brand-700 dark:text-brand-500" />
                        <h4 className="text-sm font-semibold text-foreground">User activity</h4>
                        <span className="text-xs text-muted-foreground font-normal hidden sm:inline">Orders and requests made with this key</span>
                    </div>
                    <UserActivityPanel keyId={item.id} userId={item.user.id} />
                </div>
            )}
        </div>
    )
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab() {
    const [logs, setLogs] = useState<ApiLogItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [failed, setFailed] = useState(false)
    const PER_PAGE = 50

    const fetchLogs = useCallback(async (p = 1) => {
        setIsLoading(true)
        setFailed(false)
        try {
            const res = await fetch(`/api/admin/api-keys?tab=logs&page=${p}&limit=${PER_PAGE}`)
            if (res.ok) {
                const json = await res.json()
                setLogs(json.logs || [])
                setTotal(json.pagination?.total || 0)
                setPage(p)
            } else setFailed(true)
        } catch { setFailed(true) }
        finally { setIsLoading(false) }
    }, [])

    useEffect(() => { fetchLogs(1) }, [fetchLogs])

    const statusColor = (code: number) => {
        if (code < 300) return 'text-emerald-700 dark:text-emerald-400'
        if (code < 400) return 'text-brand-700 dark:text-brand-400'
        if (code < 500) return 'text-amber-600 dark:text-amber-400'
        return 'text-red-600 dark:text-red-400'
    }

    const methodColor = (method: string) => {
        if (method === 'GET') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
        if (method === 'POST') return 'bg-brand-500/10 text-brand-700 dark:text-brand-400 border-brand-500/20'
        return 'bg-muted text-muted-foreground border-border '
    }

    const totalPages = Math.ceil(total / PER_PAGE)

    if (isLoading) return (
        <div className="space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
    )

    if (failed) return (
        <div role="alert" className="neu-raised-sm rounded-3xl p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Could not load the request logs</p>
            <p className="text-xs text-muted-foreground mt-1">Check your connection, then try again.</p>
            <Button variant="outline" size="sm" className="mt-4 h-8" onClick={() => fetchLogs(page)}>Try again</Button>
        </div>
    )

    if (logs.length === 0) return (
        <div className="text-center py-16">
            <BarChart2 className="w-12 h-12 text-muted-foreground/70 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No API request logs yet.</p>
        </div>
    )

    return (
        <div className="space-y-4">
            <div className="neu-raised-sm rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[620px]">
                        {/* Table header */}
                        <div className="grid grid-cols-[64px_1fr_1fr_72px_72px_110px] gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                            {['Method', 'Action', 'User or key', 'Status', 'Speed', 'When'].map(h => (
                                <span key={h} className="text-xs font-semibold text-muted-foreground">{h}</span>
                            ))}
                        </div>
                        {/* Rows */}
                        <div className="divide-y divide-border">
                            {logs.map(log => (
                                <div key={log.id} className="grid grid-cols-[64px_1fr_1fr_72px_72px_110px] gap-2 items-center px-4 py-3 hover:bg-muted/80 dark:hover:bg-muted/30 transition-colors">
                                    <span className={cn('inline-flex w-fit px-2 py-0.5 rounded-md text-xs font-semibold border font-mono', methodColor(log.method))}>
                                        {log.method}
                                    </span>
                                    <div className="min-w-0">
                                        <span className="text-xs font-semibold text-foreground/80 block truncate">
                                            {getFriendlyLabel(log.endpoint)}
                                        </span>
                                        <code className="text-xs text-muted-foreground font-mono truncate block">{log.endpoint}</code>
                                    </div>
                                    <div className="min-w-0">
                                        {log.user ? (
                                            <>
                                                <span className="text-xs font-medium text-foreground/80 truncate block">{log.user.name}</span>
                                                <span className="text-xs text-muted-foreground truncate block">{log.user.email}</span>
                                            </>
                                        ) : log.key_prefix ? (
                                            <span className="text-xs text-muted-foreground font-mono">{log.key_prefix}••••</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/70">—</span>
                                        )}
                                    </div>
                                    <span className={cn('text-sm font-semibold font-mono', statusColor(log.status_code))}>
                                        {log.status_code}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {log.response_time_ms}ms
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{total.toLocaleString()} total logs · Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)} className="h-8">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)} className="h-8">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'keys' | 'logs'

export default function AdminApiKeysPage() {
    const { ask, dialog } = useConfirm()
    const [tab, setTab] = useState<Tab>('keys')
    const [keys, setKeys] = useState<ApiKeyItem[]>([])
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, total_pages: 0 })
    const [stats, setStats] = useState<AggregateStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadFailed, setLoadFailed] = useState(false)
    const [settingsLoaded, setSettingsLoaded] = useState(false)
    const keysSeq = useRef(0)
    const [statusFilter, setStatusFilter] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [sortBy, setSortBy] = useState<SortBy>('recent')
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

    // Feature control settings
    const [featureEnabled, setFeatureEnabled] = useState(true)
    const [allowedRoles, setAllowedRoles] = useState<string[]>(['agent'])
    const [settingsSaving, setSettingsSaving] = useState(false)

    const fetchKeys = useCallback(async (page = 1) => {
        const seq = ++keysSeq.current
        setIsLoading(true)
        setLoadFailed(false)
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' })
            if (statusFilter) params.set('status', statusFilter)
            if (roleFilter) params.set('role', roleFilter)
            if (sortBy) params.set('sort', sortBy)
            if (debouncedSearch) params.set('search', debouncedSearch)
            const res = await fetch(`/api/admin/api-keys?${params}`)
            if (seq !== keysSeq.current) return
            if (res.ok) {
                const json = await res.json()
                if (seq !== keysSeq.current) return
                setKeys(json.keys || [])
                setPagination(json.pagination || { page: 1, limit: 50, total: 0, total_pages: 0 })
                if (json.stats) setStats(json.stats)
                if (json.settings) {
                    setFeatureEnabled(json.settings.feature_enabled !== false)
                    setAllowedRoles(Array.isArray(json.settings.allowed_roles) ? json.settings.allowed_roles : ['agent'])
                    setSettingsLoaded(true)
                }
            } else setLoadFailed(true)
        } catch { if (seq === keysSeq.current) setLoadFailed(true) }
        finally { if (seq === keysSeq.current) setIsLoading(false) }
    }, [statusFilter, roleFilter, sortBy, debouncedSearch])

    // Debounce search → server query (350ms)
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350)
        return () => clearTimeout(t)
    }, [searchQuery])

    const saveSettings = async () => {
        if (!settingsLoaded) { toast.error('The saved settings have not loaded yet. Refresh the list first.'); return }
        setSettingsSaving(true)
        try {
            const res = await fetch('/api/admin/api-keys', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_settings', feature_enabled: featureEnabled, allowed_roles: allowedRoles }),
            })
            const json = await res.json().catch(() => ({}))
            if (res.ok) toast.success(json.message || 'Settings saved')
            else toast.error(json.error || 'Could not save the settings. Try again.')
        } catch { toast.error('Could not reach the server. Check your connection and try again.') }
        finally { setSettingsSaving(false) }
    }

    const toggleRole = (role: string) => {
        setAllowedRoles(prev =>
            prev.includes(role)
                ? prev.length === 1 ? prev : prev.filter(r => r !== role) // keep at least one
                : [...prev, role]
        )
    }

    useEffect(() => { fetchKeys(1) }, [fetchKeys])

    const handleAction = async (keyId: string, action: 'approve' | 'revoke') => {
        if (action === 'revoke') {
            const ok = await ask({
                title: 'Revoke this API key?',
                description: 'Anything using it stops working straight away. This cannot be undone. The owner would have to create a new key.',
                confirmLabel: 'Revoke key',
                destructive: true,
            })
            if (!ok) return
        }
        try {
            const res = await fetch('/api/admin/api-keys', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_id: keyId, action }),
            })
            const json = await res.json().catch(() => ({}))
            if (res.ok) {
                toast.success(json.message || (action === 'approve' ? 'Key approved' : 'Key revoked'))
                fetchKeys(pagination.page)
            } else {
                toast.error(json.error || 'That did not work. Try again.')
            }
        } catch { toast.error('Could not reach the server. Check your connection and try again.') }
    }

    // Server already filtered + searched + sorted.
    const filteredKeys = keys

    const pendingCount = keys.filter(k => k.status === 'pending').length
    const activeCount = keys.filter(k => k.status === 'active').length

    return (
        <div className="space-y-6">
            {dialog}

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl clay-gold flex items-center justify-center shadow-lg shadow-brand-500/20 flex-shrink-0">
                        <Key className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-display text-xl font-bold text-foreground tracking-tight">API keys</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Approve or revoke keys and set how many requests each can make</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchKeys(pagination.page)}
                    className="gap-2 h-9 text-xs font-semibold flex-shrink-0"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </Button>
            </div>

            {/* ── Stats ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                <StatCard icon={Key} label="All keys" value={pagination.total.toLocaleString()} accent="slate" />
                <StatCard icon={Clock} label="Waiting for approval" value={pendingCount.toLocaleString()} sub="On this page" accent="amber" pulse={pendingCount > 0} />
                <StatCard icon={CheckCircle2} label="Active" value={activeCount.toLocaleString()} sub="On this page" accent="emerald" />
                <StatCard icon={Activity} label="Requests (24h)" value={(stats?.requests_24h ?? 0).toLocaleString()} accent="violet" />
                <StatCard
                    icon={Wallet}
                    label="Revenue (24h)"
                    value={`GH₵ ${(stats?.revenue_24h ?? 0).toFixed(2)}`}
                    sub={`GH₵ ${(stats?.revenue_all_time ?? 0).toFixed(2)} lifetime`}
                    accent="indigo"
                />
                <StatCard
                    icon={Percent}
                    label="Success rate (24h)"
                    value={`${(stats?.success_rate_24h ?? 0).toFixed(1)}%`}
                    sub={`${(stats?.requests_ok_24h ?? 0).toLocaleString()} ok`}
                    accent={(stats?.success_rate_24h ?? 100) >= 90 ? 'emerald' : (stats?.success_rate_24h ?? 0) >= 70 ? 'amber' : 'red'}
                />
                <StatCard
                    icon={AlertOctagon}
                    label="Failed (24h)"
                    value={(stats?.requests_err_24h ?? 0).toLocaleString()}
                    accent="red"
                    pulse={(stats?.requests_err_24h ?? 0) > 0}
                />
                <StatCard
                    icon={Gauge}
                    label="Average speed"
                    value={`${stats?.avg_response_ms ?? 0}ms`}
                    sub={stats?.top_user ? `Top: ${stats.top_user.name}` : undefined}
                    accent="sky"
                />
            </div>

            {stats?.top_user && (
                <div className="neu-raised-sm rounded-3xl p-3 sm:p-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-[11px] font-semibold text-foreground">Busiest user (24h)</p>
                            <p className="text-sm font-semibold text-foreground truncate">{stats.top_user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{stats.top_user.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-lg sm:text-xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{stats.top_user.requests.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">requests</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Feature Controls ────────────────────────────────────────── */}
            <div className="p-5 neu-raised-sm rounded-3xl">
                <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-4 h-4 text-brand-700 dark:text-brand-500" />
                    <h3 className="font-display text-sm font-semibold text-foreground">API access</h3>
                    <span className="text-xs text-muted-foreground font-normal">Applies to everyone</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-6">
                    {/* Master toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                        aria-pressed={featureEnabled}
                        onClick={() => setFeatureEnabled(e => !e)}
                            className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all',
                                featureEnabled
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400'
                            )}
                        >
                            {featureEnabled
                                ? <ToggleRight className="w-5 h-5" />
                                : <ToggleLeft className="w-5 h-5" />
                            }
                            API access is {featureEnabled ? 'on' : 'off'}
                        </button>
                    </div>

                    {/* Role allowlist */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">Who can use API keys</p>
                        <div className="flex flex-wrap gap-2">
                            {(['agent', 'dealer', 'subagent', 'customer', 'sub-admin', 'admin'] as const).map(role => (
                                <label key={role} className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all',
                                    allowedRoles.includes(role)
                                        ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-400'
                                        : 'bg-muted/50 border-border text-muted-foreground'
                                )}>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={allowedRoles.includes(role)}
                                        onChange={() => toggleRole(role)}
                                    />
                                    {allowedRoles.includes(role)
                                        ? <Check className="w-3 h-3" />
                                        : <X className="w-3 h-3" />
                                    }
                                    {role}
                                </label>
                            ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">Only the selected roles can create and use keys.</p>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={saveSettings}
                        disabled={settingsSaving}
                        className="h-8 text-xs font-semibold clay-black gap-1.5"
                    >
                        {settingsSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {settingsSaving ? 'Saving…' : 'Save settings'}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">Changes apply to new requests straight away. Press Save to keep them.</p>
                </div>
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div className="flex gap-1 p-1 bg-muted dark:bg-muted/80 rounded-2xl w-fit">
                {([
                    { id: 'keys', label: 'Keys', icon: Key },
                    { id: 'logs', label: 'Request logs', icon: BarChart2 },
                ] as { id: Tab; label: string; icon: any }[]).map(t => {
                    const Icon = t.icon
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                                tab === t.id
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground/80 dark:hover:text-muted-foreground/70'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                            {t.id === 'keys' && pendingCount > 0 && (
                                <span className="bg-amber-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Keys Tab ───────────────────────────────────────────────── */}
            {tab === 'keys' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="space-y-2.5">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                aria-label="Search keys" placeholder="Search by name, email, phone or key prefix…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-9 py-2.5 neu-raised-sm rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-foreground placeholder:text-muted-foreground"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted dark:hover:bg-muted text-muted-foreground hover:text-muted-foreground dark:hover:text-foreground transition-colors"
                                    aria-label="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Status pills + Role + Sort */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                            {/* Status pills */}
                            <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto no-scrollbar">
                                {(['', 'pending', 'active', 'revoked'] as const).map(f => (
                                    <button
                                        key={f || 'all'}
                                        type="button"
                                        onClick={() => setStatusFilter(f)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize whitespace-nowrap',
                                            statusFilter === f
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground/80 dark:hover:text-muted-foreground/70'
                                        )}
                                    >
                                        {f || 'All'}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-2 sm:ml-auto">
                                {/* Role filter */}
                                <div className="relative flex-1 sm:flex-initial">
                                    <select
                                        value={roleFilter}
                                        onChange={e => setRoleFilter(e.target.value)}
                                        aria-label="Filter by role"
                                        className="appearance-none pl-3 pr-8 py-2 neu-raised-sm rounded-2xl text-xs font-semibold text-foreground/80 focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer w-full"
                                    >
                                        <option value="">All roles</option>
                                        <option value="agent">Agent</option>
                                        <option value="dealer">Dealer</option>
                                        <option value="customer">Customer</option>
                                        <option value="sub-admin">Sub-admin</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                </div>

                                {/* Sort */}
                                <div className="relative flex-1 sm:flex-initial">
                                    <select
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value as SortBy)}
                                        aria-label="Sort by"
                                        className="appearance-none pl-3 pr-8 py-2 neu-raised-sm rounded-2xl text-xs font-semibold text-foreground/80 focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer w-full"
                                    >
                                        <option value="recent">Newest</option>
                                        <option value="oldest">Oldest</option>
                                        <option value="requests">Most requests</option>
                                        <option value="last_used">Last used</option>
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Key list */}
                    {loadFailed && !isLoading ? (
                        <div role="alert" className="neu-raised-sm rounded-3xl p-8 text-center">
                            <p className="text-sm font-semibold text-foreground">Could not load the API keys</p>
                            <p className="text-xs text-muted-foreground mt-1">Check your connection, then try again.</p>
                            <Button variant="outline" size="sm" className="mt-4 h-8" onClick={() => fetchKeys(pagination.page)}>Try again</Button>
                        </div>
                    ) : isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                        </div>
                    ) : filteredKeys.length === 0 ? (
                        <div className="text-center py-16 neu-raised-sm rounded-3xl">
                            <Shield className="w-12 h-12 text-muted-foreground/70 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-foreground">No keys found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {statusFilter || roleFilter || debouncedSearch ? 'Nothing matches these filters. Try clearing them.' : 'Nobody has created an API key yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredKeys.map(key => (
                                <KeyRow key={key.id} item={key} onAction={handleAction} />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.total_pages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-muted-foreground">
                                Page {pagination.page} of {pagination.total_pages} · {pagination.total} keys
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                                    onClick={() => fetchKeys(pagination.page - 1)} className="h-8">
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.total_pages}
                                    onClick={() => fetchKeys(pagination.page + 1)} className="h-8">
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Logs Tab ───────────────────────────────────────────────── */}
            {tab === 'logs' && <LogsTab />}
        </div>
    )
}
