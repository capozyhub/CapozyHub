'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    Phone, RefreshCw, Loader2, CheckCircle, XCircle, Clock, Settings2, Save,
    AlertTriangle, Search, Calendar, TrendingUp, Coins,
    Mail, Copy,
    Zap, Download, LayoutDashboard, Database, Filter, Repeat2, Wifi, Wallet,
    Check, ListChecks, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatCurrency, normalizeWhatsAppNumber } from '@/lib/utils'
import { Notice } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'
import { toast } from '@/lib/toast'
import {
    format,
    startOfDay,
    endOfDay,
    subDays,
    startOfWeek,
    startOfMonth,
    isWithinInterval,
    parseISO,
    isSameDay,
} from 'date-fns'

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORKS = ['MTN', 'Telecel', 'AT'] as const
type Network = typeof NETWORKS[number]
type ActiveTab = 'orders' | 'batches' | 'settings'
type SettingsTab = 'airtime' | 'mashup'

const STATUS_TRANSITIONS: Record<string, string[]> = {
    pending:    ['processing', 'completed', 'failed'],
    processing: ['completed', 'failed'],
    completed:  [],
    failed:     [],
}

const NETWORK_COLORS: Record<Network, string> = {
    MTN:    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    Telecel:'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
    AT:     'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
    id: string
    reference_code: string
    status: string
    network: Network
    beneficiary_phone: string
    airtime_amount: number
    fee_amount: number
    admin_fee_amount: number
    shop_fee_amount: number
    fee_rate: number
    total_paid: number
    user_role: string
    created_at: string
    type: 'airtime' | 'mashup'
    bundle_preference?: 'balanced' | 'data' | 'voice' | null
    shop_id?: string
    shop_name?: string
    fulfillment_note?: string
    fulfilled_at?: string
    fulfillment_service?: string | null
    fulfillment_metadata?: any
    airtime_fulfillment_attempts?: number
    users?: { first_name: string; last_name: string; email: string; phone_number?: string }
}

interface AirtimeBatch {
    id: string
    batch_name: string
    status: string
    order_count: number
    completed_count: number
    failed_count: number
    fulfillment_service: string | null
    notes: string | null
    created_at: string
    created_by_user?: { first_name: string; last_name: string }
}

interface AirtimeSettings {
    // Airtime fees
    airtime_fee_mtn_customer: string;    airtime_fee_mtn_agent: string;    airtime_fee_mtn_dealer: string
    airtime_fee_telecel_customer: string; airtime_fee_telecel_agent: string; airtime_fee_telecel_dealer: string
    airtime_fee_at_customer: string;     airtime_fee_at_agent: string;     airtime_fee_at_dealer: string
    // Airtime per-role limits
    airtime_min_amount_customer: string; airtime_min_amount_agent: string; airtime_min_amount_dealer: string
    airtime_max_amount_customer: string; airtime_max_amount_agent: string; airtime_max_amount_dealer: string
    // Airtime toggles
    airtime_enabled_mtn: string; airtime_enabled_telecel: string; airtime_enabled_at: string
    // Mashup fees
    mashup_fee_mtn_customer: string;    mashup_fee_mtn_agent: string;    mashup_fee_mtn_dealer: string
    mashup_fee_telecel_customer: string; mashup_fee_telecel_agent: string; mashup_fee_telecel_dealer: string
    mashup_fee_at_customer: string;     mashup_fee_at_agent: string;     mashup_fee_at_dealer: string
    // Mashup per-role limits
    mashup_min_amount_customer: string; mashup_min_amount_agent: string; mashup_min_amount_dealer: string
    mashup_max_amount_customer: string; mashup_max_amount_agent: string; mashup_max_amount_dealer: string
    // Mashup toggles
    mashup_enabled_mtn: string; mashup_enabled_telecel: string; mashup_enabled_at: string
    // Dashboard + Storefront toggles
    dashboard_airtime_enabled: string; dashboard_mashup_enabled: string
    storefront_airtime_enabled: string; storefront_mashup_enabled: string
}

// ─── SVG Network Logos ────────────────────────────────────────────────────────

function MTNLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-6 h-6" fill="none">
            <circle cx="30" cy="30" r="30" fill="#FFD200"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1a1a1a">MTN</text>
        </svg>
    )
}
function TelecelLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-6 h-6" fill="none">
            <circle cx="30" cy="30" r="30" fill="#e63946"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">Telecel</text>
        </svg>
    )
}
function ATLogo() {
    return (
        <svg viewBox="0 0 60 60" className="w-6 h-6" fill="none">
            <circle cx="30" cy="30" r="30" fill="#F97316"/>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">AT</text>
        </svg>
    )
}
const NetworkLogo = ({ id, className }: { id: string; className?: string }) => {
    const inner = id === 'MTN' ? <MTNLogo /> : id === 'Telecel' ? <TelecelLogo /> : <ATLogo />
    return <span className={className}>{inner}</span>
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
    pending:    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    processing: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
    completed:  'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    failed:     'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
    refunded:   'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900',
}

function StatusBadge({ status }: { status: string }) {
    const icons: Record<string, React.ReactNode> = {
        pending:    <Clock className="w-3 h-3" />,
        processing: <Loader2 className="w-3 h-3 animate-spin" />,
        completed:  <CheckCircle className="w-3 h-3" />,
        failed:     <XCircle className="w-3 h-3" />,
        refunded:   <RefreshCw className="w-3 h-3" />,
    }
    return (
        <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium uppercase border whitespace-nowrap',
            STATUS_STYLES[status] || 'bg-muted text-muted-foreground border-border ',
        )}>
            {icons[status]} {status}
        </span>
    )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasCorruptData(o: Order) {
    return o.fee_rate > 100 || (o.total_paid > o.airtime_amount * 3 && o.airtime_amount > 0)
}

// Single source of truth for per-order earnings. Tolerant of the admin_fee_amount DEFAULT-0 trap:
// use admin_fee_amount when it's actually split (>0), else derive admin = fee - shop for a shop
// order, else the whole fee for a direct order.
function earningsOf(o: Order) {
    const shop = o.shop_id ? Math.max(0, o.shop_fee_amount || 0) : 0
    const adminMarkup = (o.admin_fee_amount && o.admin_fee_amount > 0)
        ? o.admin_fee_amount
        : (o.shop_id ? Math.max(0, (o.fee_amount || 0) - shop) : (o.fee_amount || 0))
    return { adminMarkup, shop, totalAdmin: adminMarkup }
}

// Admin refund is allowed for any non-terminal-good airtime (never completed / already refunded).
// Shop airtime is skipped server-side (refund via the shop order) — the button still shows.
function canRefund(o: Order) {
    return o.status === 'pending' || o.status === 'processing' || o.status === 'failed'
}

// Translate the UI time period into an ISO range for the server-side stats aggregate.
function periodRange(timePeriod: string, customStart: string, customEnd: string): { start: string | null; end: string | null } {
    const now = new Date()
    switch (timePeriod) {
        case 'Today':      return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() }
        case 'Yesterday':  return { start: startOfDay(subDays(now, 1)).toISOString(), end: endOfDay(subDays(now, 1)).toISOString() }
        case 'This Week':  return { start: startOfWeek(now).toISOString(), end: endOfDay(now).toISOString() }
        case 'This Month': return { start: startOfMonth(now).toISOString(), end: endOfDay(now).toISOString() }
        case 'Custom':     return customStart && customEnd
            ? { start: startOfDay(new Date(customStart)).toISOString(), end: endOfDay(new Date(customEnd)).toISOString() }
            : { start: null, end: null }
        default:           return { start: null, end: null }
    }
}

// ─── Order Card (secondary view) ──────────────────────────────────────────────

function OrderCard({ order, onAction, onRefund, busy, selectionMode, selected, onToggleSelect }: {
    order: Order; onAction: (o: Order) => void
    onRefund: (o: Order) => void
    busy?: boolean; selectionMode?: boolean; selected?: boolean; onToggleSelect?: (o: Order) => void
}) {
    const isFailed   = order.status === 'failed'
    const corrupt    = hasCorruptData(order)
    const { adminMarkup, shop } = earningsOf(order)
    const attempts    = order.airtime_fulfillment_attempts ?? 0
    const canAct      = (STATUS_TRANSITIONS[order.status]?.length ?? 0) > 0
    const provider    = order.fulfillment_service

    return (
        <div
            onClick={selectionMode ? () => onToggleSelect?.(order) : undefined}
            className={cn(
                'neu-raised-sm rounded-3xl p-4 transition-all',
                selectionMode && 'cursor-pointer select-none active:scale-[0.99]',
                selected && 'ring-2 ring-brand-500',
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {selectionMode && (
                        <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                            selected ? 'bg-brand-500 border-brand-500 text-black' : 'border-border')}>
                            {selected && <Check className="w-3.5 h-3.5" />}
                        </span>
                    )}
                    <div className="neu-inset w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                        <NetworkLogo id={order.network} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm font-semibold text-foreground truncate">
                                {order.network} {order.type === 'mashup' ? 'Mashup' : 'Airtime'}
                            </span>
                            <StatusBadge status={order.status} />
                        </div>
                        <p className="font-mono text-xs text-muted-foreground truncate">{order.reference_code}</p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-[11px] text-muted-foreground">Total paid</p>
                    <p className="text-base font-bold tabular-nums text-foreground leading-tight">
                        {isFailed ? '—' : formatCurrency(order.total_paid)}
                    </p>
                </div>
            </div>

            {/* Tags */}
            {(order.type === 'mashup' || order.bundle_preference || order.shop_name || corrupt) && (
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {order.type === 'mashup' && (
                        <Badge variant="outline" className="text-xs font-medium gap-1">
                            <Zap className="w-3 h-3" /> Mashup
                        </Badge>
                    )}
                    {order.bundle_preference && (
                        <Badge variant="outline" className="text-xs font-medium text-muted-foreground border-border ">
                            {order.bundle_preference === 'balanced' ? 'Balanced' : order.bundle_preference === 'data' ? 'Data' : 'Voice'}
                        </Badge>
                    )}
                    {order.shop_name && (
                        <Badge variant="outline" className="text-xs font-medium max-w-[10rem] truncate">
                            Shop: {order.shop_name}
                        </Badge>
                    )}
                    {corrupt && (
                        <Badge variant="outline" className="text-xs font-medium bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900">
                            Data error
                        </Badge>
                    )}
                </div>
            )}

            {/* Customer / Beneficiary */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div className="neu-inset rounded-2xl p-2.5 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">Initiator</p>
                    <p className="font-medium text-foreground truncate">{order.users?.first_name} {order.users?.last_name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{order.users?.email}</span>
                    </p>
                </div>
                <div className="neu-inset rounded-2xl p-2.5 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">Beneficiary</p>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                        <span className="font-mono font-medium text-foreground truncate">{order.beneficiary_phone}</span>
                        <button
                            onClick={() => { navigator.clipboard?.writeText(normalizeWhatsAppNumber(order.beneficiary_phone)).then(() => toast.success('Number copied'), () => toast.error('Could not copy. Select the number and copy it by hand.')) }}
                            className={cn("shrink-0 rounded text-muted-foreground hover:text-foreground transition-colors p-1", FOCUS)}
                            aria-label="Copy beneficiary number"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Earnings strip */}
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mb-3 text-xs rounded-xl bg-muted/60 px-3 py-2">
                <span className="text-muted-foreground">Net <span className="font-semibold tabular-nums text-foreground">{order.airtime_amount.toFixed(2)}</span></span>
                <span className="text-muted-foreground/70 ">·</span>
                <span className="text-muted-foreground">Admin <span className="font-semibold tabular-nums text-foreground">{isFailed || corrupt ? '—' : adminMarkup.toFixed(2)}</span></span>
                {order.shop_id && (<><span className="text-muted-foreground/70 ">·</span>
                    <span className="text-muted-foreground">Shop <span className="font-semibold tabular-nums text-foreground/80 ">{isFailed || corrupt ? '—' : shop.toFixed(2)}</span></span></>)}
                <span className="text-muted-foreground/70 ">·</span>
                <span className="text-muted-foreground tabular-nums">{order.fee_rate.toFixed(1)}%</span>
            </div>

            {/* Provider / attempts */}
            {(provider || attempts > 1) && (
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {provider && (
                        <Badge variant="outline" className="text-xs font-medium text-muted-foreground border-border ">
                            {provider}
                        </Badge>
                    )}
                    {attempts > 1 && (
                        <Badge variant="outline" className="text-xs font-medium gap-1">
                            <Repeat2 className="w-3 h-3" /> Attempt {attempts}
                        </Badge>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-border space-y-2.5">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 shrink-0" /> {format(parseISO(order.created_at), 'MMM d, yyyy · p')}
                </span>
                {!selectionMode && (canAct || canRefund(order)) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {canAct && (
                            <Button size="sm" variant="outline" disabled={busy} className="flex-1 h-9 text-xs" onClick={() => onAction(order)}>
                                Override
                            </Button>
                        )}
                        {canRefund(order) && (
                            <Button size="sm" variant="outline" disabled={busy}
                                className="flex-1 h-9 text-xs gap-1.5"
                                onClick={() => onRefund(order)}>
                                <RefreshCw className="w-3.5 h-3.5" /> Refund
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Status Action Modal (manual override / retry) ────────────────────────────

function ActionModal({ order, onClose, onSuccess }: { order: Order | null; onClose: () => void; onSuccess: () => void }) {
    const [targetStatus, setTargetStatus] = useState('')
    const [note, setNote] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => { if (order) { setTargetStatus(''); setNote('') } }, [order])

    const transitions = order ? (STATUS_TRANSITIONS[order.status] || []) : []

    const handleSubmit = async () => {
        if (!order || !targetStatus) return
        if (targetStatus === 'failed' && !note.trim()) {
            toast.error('Add a reason before marking this order failed.')
            return
        }
        setLoading(true)
        try {
            const res = await fetch('/api/admin/airtime/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, status: targetStatus, fulfillmentNote: note }),
            })
            const d = await res.json()
            if (!res.ok) { toast.error(d.error || 'We could not update this order. Try again.'); return }
            toast.success(`Order marked ${targetStatus}`)
            onSuccess()
            onClose()
        } catch { toast.error('We could not update this order. Check your connection and try again.') }
        finally { setLoading(false) }
    }

    return (
        <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose() }}>
            <DialogContent className="rounded-[2rem] max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">Manual override</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground font-mono">
                        {order?.reference_code}
                    </DialogDescription>
                </DialogHeader>

                {order && (
                    <>
                        <div className="neu-inset rounded-2xl p-3 space-y-2 text-sm">
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-muted-foreground">Customer</span>
                                <span className="font-medium text-foreground truncate">{order.users?.first_name} {order.users?.last_name}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-muted-foreground">Amount</span>
                                <span className="font-semibold tabular-nums text-foreground">{formatCurrency(order.airtime_amount)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-muted-foreground">Network</span>
                                <Badge variant="outline" className={cn('text-xs font-medium', NETWORK_COLORS[order.network])}>{order.network}</Badge>
                            </div>
                            {order.fulfillment_service && (
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-muted-foreground">Provider</span>
                                    <span className="font-medium text-foreground/80 truncate">{order.fulfillment_service}</span>
                                </div>
                            )}
                        </div>

                        {transitions.length === 0 ? (
                            <div className="text-center py-4 space-y-2">
                                <CheckCircle className="w-9 h-9 text-muted-foreground mx-auto" />
                                <p className="text-sm text-muted-foreground">This order is finalised and cannot be changed.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">Change status to</Label>
                                    <div className="flex gap-2">
                                        {transitions.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                aria-pressed={targetStatus === s}
                                                onClick={() => setTargetStatus(s)}
                                                className={cn(
                                                    'flex-1 h-9 rounded-lg text-sm font-medium capitalize border transition-colors',
                                                    targetStatus === s
                                                        ? s === 'failed' ? 'bg-red-600 border-red-600 text-white' : 'clay-gold border-transparent'
                                                        : 'border-border text-muted-foreground hover:text-foreground',
                                                )}
                                            >{s}</button>
                                        ))}
                                    </div>
                                </div>
                                {targetStatus === 'failed' && (
                                    <div>
                                        <Label className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 block">Reason for failure</Label>
                                        <Input
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                            placeholder="Why did it fail?"
                                            aria-label="Reason for failure"
                                            className="h-9 text-sm"
                                            autoFocus
                                        />
                                        <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 leading-snug">
                                            This does not refund the customer. Use Refund on the order if they should get their money back.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" className="h-9 flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
                    {transitions.length > 0 && (
                        <Button className="h-9 flex-1" onClick={handleSubmit} disabled={!targetStatus || loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── NetworkFeeSection (Settings) ─────────────────────────────────────────────

const ROLES = ['customer', 'agent', 'dealer'] as const
const ROLE_LABELS: Record<string, string> = { customer: 'Customer', agent: 'Agent', dealer: 'Dealer' }

function NetworkFeeSection({
    productType,
    settings,
    setSettings,
}: {
    productType: SettingsTab
    settings: AirtimeSettings
    setSettings: React.Dispatch<React.SetStateAction<AirtimeSettings>>
}) {
    return (
        <div className="neu-raised-sm rounded-3xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
                <h2 className="font-display text-base font-bold tracking-tight text-foreground">
                    {productType === 'airtime' ? 'Airtime' : 'Mashup'} fees
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Markup per network and role. Applies to {productType} orders only.
                </p>
            </div>
            <div className="divide-y divide-border">
                {NETWORKS.map(net => {
                    const enabledKey = `${productType}_enabled_${net.toLowerCase()}` as keyof AirtimeSettings
                    const isEnabled = settings[enabledKey] !== 'false'

                    return (
                        <div key={net} className="px-4 py-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="neu-inset w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                                        <NetworkLogo id={net} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-semibold text-foreground truncate">{net}</h3>
                                        <span className={cn('text-xs', isEnabled ? 'text-foreground' : 'text-muted-foreground')}>
                                            {isEnabled ? 'On' : 'Off'}
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={isEnabled}
                                    onCheckedChange={v => setSettings(s => ({ ...s, [enabledKey]: v ? 'true' : 'false' }))}
                                    aria-label={`${net} ${productType} on or off`}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {ROLES.map(role => {
                                    const feeKey = `${productType}_fee_${net.toLowerCase()}_${role}` as keyof AirtimeSettings
                                    const feeVal = parseFloat(settings[feeKey] || '0')
                                    const preview = (10 * (1 + feeVal / 100)).toFixed(2)
                                    return (
                                        <div key={role} className="space-y-1.5 min-w-0">
                                            <div className="flex justify-between items-center gap-1">
                                                <Label htmlFor={`${productType}-${net}-${role}-fee`} className="text-xs font-medium text-muted-foreground truncate">{ROLE_LABELS[role]}</Label>
                                                <span className="text-xs text-muted-foreground tabular-nums shrink-0">GH₵10 costs GH₵{preview}</span>
                                            </div>
                                            <div className="relative">
                                                <Input
                                                    id={`${productType}-${net}-${role}-fee`}
                                                    type="number"
                                                    value={settings[feeKey]}
                                                    onChange={e => setSettings(s => ({ ...s, [feeKey]: e.target.value }))}
                                                    className="h-9 pr-8 text-sm tabular-nums"
                                                    min="0" max="100" step="0.1"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── LimitsAndTogglesSection (Settings) ──────────────────────────────────────

function LimitsAndTogglesSection({
    productType,
    settings,
    setSettings,
    savingSettings,
    onSave,
}: {
    productType: SettingsTab
    settings: AirtimeSettings
    setSettings: React.Dispatch<React.SetStateAction<AirtimeSettings>>
    savingSettings: boolean
    onSave: () => void
}) {
    const dashKey = `dashboard_${productType}_enabled` as keyof AirtimeSettings
    const sfKey = `storefront_${productType}_enabled` as keyof AirtimeSettings

    return (
        <div className="neu-raised-sm rounded-3xl shadow-sm p-4 space-y-5">
            <div>
                <h2 className="text-sm font-semibold text-foreground">
                    {productType === 'airtime' ? 'Airtime' : 'Mashup'} controls
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Visibility, limits &amp; storefronts</p>
            </div>

            {/* Visibility toggles */}
            <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Visibility</p>
                <div className="neu-inset flex items-center justify-between gap-2 rounded-2xl p-3">
                    <div className="min-w-0">
                        <Label className="text-sm font-medium text-foreground">Dashboard</Label>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">Show on the member dashboard</p>
                    </div>
                    <Switch
                        checked={settings[dashKey] !== 'false'}
                        onCheckedChange={v => setSettings(s => ({ ...s, [dashKey]: v ? 'true' : 'false' }))}
                    />
                </div>
                <div className="neu-inset flex items-center justify-between gap-2 rounded-2xl p-3">
                    <div className="min-w-0">
                        <Label className="text-sm font-medium text-foreground">Storefront</Label>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">Allow shop storefronts to sell {productType}</p>
                    </div>
                    <Switch
                        checked={settings[sfKey] !== 'false'}
                        onCheckedChange={v => setSettings(s => ({ ...s, [sfKey]: v ? 'true' : 'false' }))}
                    />
                </div>
            </div>

            {/* Per-role limits */}
            <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Order limits per role (GH₵)</p>
                {ROLES.map(role => {
                    const minKey = `${productType}_min_amount_${role}` as keyof AirtimeSettings
                    const maxKey = `${productType}_max_amount_${role}` as keyof AirtimeSettings
                    return (
                        <div key={role} className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground capitalize">{role}</p>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={settings[minKey]}
                                        onChange={e => setSettings(s => ({ ...s, [minKey]: e.target.value }))}
                                        className="h-9 pr-12 text-sm tabular-nums"
                                        min="0.5" step="0.5"
                                        placeholder="Min"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Min</span>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={settings[maxKey]}
                                        onChange={e => setSettings(s => ({ ...s, [maxKey]: e.target.value }))}
                                        className="h-9 pr-12 text-sm tabular-nums"
                                        min="1" step="1"
                                        placeholder="Max"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Max</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Save */}
            <Button onClick={onSave} disabled={savingSettings} className="w-full h-9">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save {productType === 'airtime' ? 'airtime' : 'mashup'} settings
            </Button>

            <div className="neu-inset rounded-2xl p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-foreground leading-snug">
                    Fee and limit changes apply to every user as soon as you save.
                </p>
            </div>
        </div>
    )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent, className }: {
    icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode; accent?: string; className?: string
}) {
    return (
        <div className={cn('neu-raised-sm rounded-3xl p-4 shadow-sm min-w-0', className)}>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                {icon}
                <span className="text-xs font-medium truncate">{label}</span>
            </div>
            <p className={cn('font-display text-lg font-bold tabular-nums tracking-tight truncate', accent || 'text-foreground')}>{value}</p>
            {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
        </div>
    )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminAirtimePage() {
    // Tab state
    const [activeTab, setActiveTab] = useState<ActiveTab>('orders')
    const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('airtime')

    // Orders state
    const [orders, setOrders] = useState<Order[]>([])
    const [ordersLoading, setOrdersLoading] = useState(true)
    const [ordersFailed, setOrdersFailed] = useState(false)
    const ordersSeq = useRef(0)
    const statsSeq = useRef(0)
    const [statusFilter, setStatusFilter] = useState('all')
    const [networkFilter, setNetworkFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState<'all' | 'airtime' | 'mashup'>('all')
    const [search, setSearch] = useState('')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
    const [loadedCount, setLoadedCount] = useState(0)
    // Server-side aggregate (full dataset, not the 500-row window)
    const [serverStats, setServerStats] = useState<any>(null)
    // Multi-select bulk actions
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkRunning, setBulkRunning] = useState(false)
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
    // Refund confirmations (controlled — iOS-PWA safe, no native confirm)
    const [refundAirtimeOrder, setRefundAirtimeOrder] = useState<Order | null>(null)
    const [refundBulkConfirm, setRefundBulkConfirm] = useState<string[] | null>(null)

    // Time filtering
    const [timePeriod, setTimePeriod] = useState('Today')
    const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false)
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    // Settings state
    const [settings, setSettings] = useState<AirtimeSettings>({
        airtime_fee_mtn_customer: '5',    airtime_fee_mtn_agent: '3',    airtime_fee_mtn_dealer: '2',
        airtime_fee_telecel_customer: '5',airtime_fee_telecel_agent: '3',airtime_fee_telecel_dealer: '2',
        airtime_fee_at_customer: '5',     airtime_fee_at_agent: '3',     airtime_fee_at_dealer: '2',
        airtime_min_amount_customer: '1', airtime_min_amount_agent: '1', airtime_min_amount_dealer: '1',
        airtime_max_amount_customer: '500',airtime_max_amount_agent: '1000',airtime_max_amount_dealer: '2000',
        airtime_enabled_mtn: 'true', airtime_enabled_telecel: 'true', airtime_enabled_at: 'true',
        mashup_fee_mtn_customer: '5',    mashup_fee_mtn_agent: '3',    mashup_fee_mtn_dealer: '2',
        mashup_fee_telecel_customer: '5',mashup_fee_telecel_agent: '3',mashup_fee_telecel_dealer: '2',
        mashup_fee_at_customer: '5',     mashup_fee_at_agent: '3',     mashup_fee_at_dealer: '2',
        mashup_min_amount_customer: '5', mashup_min_amount_agent: '5', mashup_min_amount_dealer: '5',
        mashup_max_amount_customer: '500',mashup_max_amount_agent: '1000',mashup_max_amount_dealer: '2000',
        mashup_enabled_mtn: 'true', mashup_enabled_telecel: 'true', mashup_enabled_at: 'true',
        dashboard_airtime_enabled: 'true', dashboard_mashup_enabled: 'true',
        storefront_airtime_enabled: 'false', storefront_mashup_enabled: 'false',
    })
    const [settingsLoading, setSettingsLoading] = useState(true)
    // Until the saved settings have loaded, the form holds placeholder defaults. Saving then would overwrite the real fees.
    const [settingsLoaded, setSettingsLoaded] = useState(false)
    const [savingSettings, setSavingSettings] = useState(false)

    // Batches state
    const [batches, setBatches] = useState<AirtimeBatch[]>([])
    const [batchesLoading, setBatchesLoading] = useState(false)
    const [creatingBatch, setCreatingBatch] = useState(false)

    // ── Data loaders ──────────────────────────────────────────────────────────

    const loadOrders = useCallback(async () => {
        const seq = ++ordersSeq.current
        setOrdersLoading(true)
        setOrdersFailed(false)
        try {
            const params = new URLSearchParams({ limit: '500' })
            const res = await fetch(`/api/admin/airtime/orders?${params}`)
            if (!res.ok) throw new Error('load failed')
            const d = await res.json()
            if (seq !== ordersSeq.current) return
            setOrders(d.orders || [])
            setLoadedCount(typeof d.total === 'number' ? d.total : (d.orders?.length ?? 0))
        } catch (e) {
            if (seq !== ordersSeq.current) return
            console.error(e)
            setOrdersFailed(true)
            toast.error('We could not load orders. Try again.')
        } finally {
            if (seq === ordersSeq.current) setOrdersLoading(false)
        }
    }, [])

    // Server-side aggregate over the FULL dataset (not the 500-row list window).
    const loadStats = useCallback(async () => {
        const { start, end } = periodRange(timePeriod, customStart, customEnd)
        const params = new URLSearchParams()
        if (networkFilter !== 'all') params.set('network', networkFilter)
        if (typeFilter !== 'all') params.set('type', typeFilter)
        if (start) params.set('start', start)
        if (end) params.set('end', end)
        const seq = ++statsSeq.current
        try {
            const res = await fetch(`/api/admin/airtime/stats?${params}`)
            if (res.ok) { const d = await res.json(); if (seq === statsSeq.current) setServerStats(d.stats || null) }
        } catch (e) { console.error(e) }
    }, [networkFilter, typeFilter, timePeriod, customStart, customEnd])

    const handleBulk = useCallback(async (action: 'refund' | 'complete', ids: string[]) => {
        if (ids.length === 0) { toast.error('None of the selected orders can take this action.'); return }
        setBulkRunning(true)
        setBulkProgress({ done: 0, total: ids.length })
        try {
            const res = await fetch('/api/admin/airtime/bulk', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, orderIds: ids }),
            })
            const d = await res.json().catch(() => ({}))
            if (!res.ok) { toast.error(d.error || 'The bulk action failed. Try again.'); return }
            const s = d.summary || { ok: 0, failed: 0, skipped: 0 }
            const label = action === 'refund' ? 'Refund' : 'Complete'
            const msg = `${label}: ${s.ok} done, ${s.failed} failed, ${s.skipped} skipped`
            if (s.failed > 0) toast.error(msg); else toast.success(msg)
            setSelectedIds(new Set()); setSelectionMode(false)
        } catch { toast.error('We lost the connection during the bulk action. Check the orders before trying again.') }
        finally { setBulkRunning(false); setBulkProgress(null); loadOrders(); loadStats() }
    }, [loadOrders, loadStats])

    const loadSettings = useCallback(async () => {
        setSettingsLoading(true)
        try {
            const res = await fetch('/api/admin/airtime/settings')
            if (res.ok) { const d = await res.json(); setSettings(s => ({ ...s, ...d.settings })); setSettingsLoaded(true) }
            else toast.error('We could not load the saved settings. Try again before changing anything.')
        } catch (e) { console.error(e); toast.error('We could not load the saved settings. Try again before changing anything.') }
        setSettingsLoading(false)
    }, [])

    const loadBatches = useCallback(async () => {
        setBatchesLoading(true)
        try {
            const res = await fetch('/api/admin/airtime/batches?limit=50')
            if (res.ok) { const d = await res.json(); setBatches(d.batches || []) }
            else toast.error('We could not load batches. Try again.')
        } catch (e) { console.error(e); toast.error('We could not load batches. Try again.') }
        setBatchesLoading(false)
    }, [])

    useEffect(() => { loadOrders() }, [loadOrders])
    useEffect(() => { loadStats() }, [loadStats])
    useEffect(() => { if (activeTab === 'settings') loadSettings() }, [activeTab, loadSettings])
    useEffect(() => { if (activeTab === 'batches')  loadBatches()  }, [activeTab, loadBatches])

    // ── Settings save ─────────────────────────────────────────────────────────

    const saveSettings = async () => {
        if (!settingsLoaded) { toast.error('Load the saved settings first, so you do not overwrite them with defaults.'); return }
        setSavingSettings(true)
        try {
            const res = await fetch('/api/admin/airtime/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            })
            if (res.ok) { toast.success('Settings saved.'); loadSettings() }
            else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'We could not save the settings. Try again.') }
        } catch { toast.error('We could not save the settings. Check your connection and try again.') }
        setSavingSettings(false)
    }

    // ── Batch actions ─────────────────────────────────────────────────────────

    const createBatch = async () => {
        const pendingIds = filteredOrders.filter(o => o.status === 'pending').map(o => o.id)
        if (pendingIds.length === 0) { toast.error('There are no pending orders in this view to batch.'); return }
        setCreatingBatch(true)
        try {
            const res = await fetch('/api/admin/airtime/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderIds: pendingIds }),
            })
            const d = await res.json()
            if (!res.ok) { toast.error(d.error || 'We could not create the batch. Try again.'); return }
            toast.success(`Batch created. ${pendingIds.length} orders are now processing.`)
            loadBatches()
            loadOrders()
        } catch { toast.error('We could not create the batch. Check your connection and try again.') }
        finally { setCreatingBatch(false) }
    }

    const completeBatch = async (batch: AirtimeBatch) => {
        try {
            const res = await fetch('/api/admin/airtime/batches', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchId: batch.id, status: 'completed' }),
            })
            const d = await res.json()
            if (!res.ok) { toast.error(d.error || 'We could not update the batch. Try again.'); return }
            toast.success(`Batch done. ${d.completedCount} orders fulfilled.`)
            loadBatches()
            loadOrders()
        } catch { toast.error('We could not update the batch. Check your connection and try again.') }
    }

    // ── Filtering ─────────────────────────────────────────────────────────────

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            // Search
            const q = search.toLowerCase()
            if (q && !(
                order.beneficiary_phone.toLowerCase().includes(q) ||
                order.reference_code.toLowerCase().includes(q) ||
                order.users?.first_name?.toLowerCase().includes(q) ||
                order.users?.last_name?.toLowerCase().includes(q) ||
                order.users?.email?.toLowerCase().includes(q)
            )) return false

            // Status
            if (statusFilter !== 'all' && order.status !== statusFilter) return false

            // Network
            if (networkFilter !== 'all' && order.network !== networkFilter) return false

            // Type
            if (typeFilter !== 'all' && order.type !== typeFilter) return false

            // Pending orders need action regardless of how old they are — the time
            // period picker is for browsing history, not for hiding what's still
            // awaiting fulfillment. Without this, a mashup (or airtime) order stuck
            // in 'pending' from days ago is invisible under the default "Today"
            // window even when the admin explicitly filters to Pending, and looks
            // identical to "no such orders exist."
            if (statusFilter === 'pending') return true

            // Time period
            if (timePeriod === 'All') return true
            const date = parseISO(order.created_at)
            const now  = new Date()
            if (timePeriod === 'Today')      return isSameDay(date, now)
            if (timePeriod === 'Yesterday')  return isSameDay(date, subDays(now, 1))
            if (timePeriod === 'This Week')  return isWithinInterval(date, { start: startOfWeek(now), end: endOfDay(now) })
            if (timePeriod === 'This Month') return isWithinInterval(date, { start: startOfMonth(now), end: endOfDay(now) })
            if (timePeriod === 'Custom' && customStart && customEnd) {
                return isWithinInterval(date, {
                    start: startOfDay(new Date(customStart)),
                    end:   endOfDay(new Date(customEnd)),
                })
            }
            return true
        })
    }, [orders, search, statusFilter, networkFilter, typeFilter, timePeriod, customStart, customEnd])

    // ── Statistics ────────────────────────────────────────────────────────────

    // Card stats prefer the server-side aggregate (full dataset); fall back to the loaded
    // window before it lands. Money figures are completed-scoped; pendingValue is at-risk money.
    const cardStats = useMemo(() => {
        if (serverStats) {
            const n = (v: any) => Number(v || 0)
            return {
                grossSales:       n(serverStats.gross_sales),
                adminMarkup:      n(serverStats.admin_markup),
                shopProfit:       n(serverStats.shop_profit),
                totalVolume:      n(serverStats.total_volume),
                pendingValue:     n(serverStats.pending_value),
                totalCount:       n(serverStats.total_count),
                airtimeCount:     n(serverStats.airtime_count),
                mashupCount:      n(serverStats.mashup_count),
                pendingCount:     n(serverStats.pending_count),
            }
        }
        const completed = filteredOrders.filter(o => o.status === 'completed')
        const sum = (fn: (o: Order) => number) => completed.reduce((a, o) => a + fn(o), 0)
        return {
            grossSales:       sum(o => o.total_paid),
            adminMarkup:      sum(o => earningsOf(o).adminMarkup),
            shopProfit:       sum(o => earningsOf(o).shop),
            totalVolume:      sum(o => o.airtime_amount),
            pendingValue:     filteredOrders.filter(o => o.status === 'pending').reduce((a, o) => a + o.total_paid, 0),
            totalCount:       filteredOrders.length,
            airtimeCount:     filteredOrders.filter(o => o.type !== 'mashup').length,
            mashupCount:      filteredOrders.filter(o => o.type === 'mashup').length,
            pendingCount:     filteredOrders.filter(o => o.status === 'pending').length,
        }
    }, [serverStats, filteredOrders])

    // ── CSV Export ────────────────────────────────────────────────────────────

    const exportCSV = () => {
        if (filteredOrders.length === 0) { toast.error('There are no orders in this view to export.'); return }
        const headers = ['Reference', 'Type', 'Network', 'Status', 'Beneficiary', 'Customer', 'Amount (GHS)', 'Admin Profit (GHS)', 'Shop Profit (GHS)', 'Total Paid (GHS)', 'Provider', 'Attempts', 'Role', 'Date']
        const rows = filteredOrders.map(o => {
            return [
                o.reference_code,
                o.type,
                o.network,
                o.status,
                o.beneficiary_phone,
                `${o.users?.first_name || ''} ${o.users?.last_name || ''}`.trim(),
                o.airtime_amount.toFixed(2),
                earningsOf(o).adminMarkup.toFixed(2),
                earningsOf(o).shop.toFixed(2),
                o.total_paid.toFixed(2),
                o.fulfillment_service || '',
                String(o.airtime_fulfillment_attempts ?? 0),
                o.user_role,
                format(parseISO(o.created_at), 'yyyy-MM-dd HH:mm'),
            ]
        })
        const csv  = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `airtime_mashup_${timePeriod.toLowerCase().replace(/\s/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${filteredOrders.length} orders.`)
    }

    const statusTabs = ['all', 'pending', 'processing', 'completed', 'failed']

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="mx-auto max-w-7xl space-y-5 pb-24">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Phone className="w-5 h-5 shrink-0" aria-hidden="true" />
                        Airtime &amp; Mashup
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        Airtime and mashup orders. You fulfil them by hand, then mark them done here.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={activeTab === 'orders' ? loadOrders : activeTab === 'batches' ? loadBatches : loadSettings}
                        disabled={ordersLoading || batchesLoading || settingsLoading}
                        className="h-9"
                    >
                        <RefreshCw className={cn('w-4 h-4 mr-2', (ordersLoading || batchesLoading || settingsLoading) && 'animate-spin')} />
                        Refresh
                    </Button>

                    {activeTab === 'orders' && (
                        <>
                            <Button variant="outline" size="sm" onClick={exportCSV} className="h-9">
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>
                            <Button
                                variant={selectionMode ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { setSelectionMode(m => !m); setSelectedIds(new Set()) }}
                                className="h-9"
                            >
                                {selectionMode
                                    ? <><X className="w-4 h-4 mr-2" /> Done</>
                                    : <><ListChecks className="w-4 h-4 mr-2" /> Select</>}
                            </Button>
                        </>
                    )}

                    {/* Tab switcher */}
                    <div className="neu-inset flex items-center rounded-full p-1">
                        {(['orders', 'batches', 'settings'] as const).map(tab => (
                            <button
                                key={tab}
                                type="button"
                                aria-pressed={activeTab === tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    'px-3 h-9 rounded-full text-sm font-semibold capitalize transition-colors flex items-center gap-1.5',
                                    FOCUS,
                                    activeTab === tab ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {tab === 'settings' ? <><Settings2 className="w-4 h-4" /> Settings</> : tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Stats (money is completed-only; Pending shows at-risk value) ─ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard
                    icon={<Coins className="w-4 h-4" />}
                    label="Admin earnings"
                    value={formatCurrency(cardStats.adminMarkup)}
                    sub="Markup on completed orders"
                />
                <StatCard
                    icon={<TrendingUp className="w-4 h-4" />}
                    label="Gross sales"
                    value={formatCurrency(cardStats.grossSales)}
                    sub={`${cardStats.airtimeCount} airtime · ${cardStats.mashupCount} mashup`}
                />
                <StatCard
                    icon={<LayoutDashboard className="w-4 h-4" />}
                    label="Shop profit"
                    value={formatCurrency(cardStats.shopProfit)}
                    sub="Earned by shop owners"
                />
                <StatCard
                    className="col-span-2 sm:col-span-1"
                    icon={<Clock className="w-4 h-4" />}
                    label="Pending"
                    value={`${cardStats.pendingCount} order${cardStats.pendingCount !== 1 ? 's' : ''}`}
                    sub={`${formatCurrency(cardStats.pendingValue)} waiting to be fulfilled`}
                    accent={cardStats.pendingCount > 0 ? 'text-foreground' : 'text-muted-foreground'}
                />
            </div>

            {/* ══ ORDERS TAB ══════════════════════════════════════════════ */}
            {activeTab === 'orders' && (
                <div className="space-y-4">
                    {/* Filter bar */}
                    <div className="neu-raised-sm rounded-3xl p-3 space-y-3">
                        <div className="flex flex-col lg:flex-row gap-2">
                            <div className="relative flex-1 min-w-0">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                <Input
                                    aria-label="Search orders"
                                    placeholder="Search by reference, number or customer"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9 h-10 text-sm"
                                />
                            </div>
                            <div className="flex gap-2 w-full lg:w-auto">
                                <Select value={networkFilter} onValueChange={setNetworkFilter}>
                                    <SelectTrigger className="flex-1 lg:w-32 h-9 text-sm">
                                        <SelectValue placeholder="Network" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All networks</SelectItem>
                                        {NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Select value={timePeriod} onValueChange={val => {
                                    if (val === 'Custom') setIsCustomDialogOpen(true)
                                    else setTimePeriod(val)
                                }}>
                                    <SelectTrigger className="flex-1 lg:w-36 h-9 text-sm">
                                        <Calendar className="w-4 h-4 mr-1 text-muted-foreground shrink-0" />
                                        <SelectValue placeholder="Period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['All', 'Today', 'Yesterday', 'This Week', 'This Month', 'Custom'].map(p => (
                                            <SelectItem key={p} value={p}>{p}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Status + type filter pills */}
                        <div className="flex flex-wrap gap-1.5">
                            {statusTabs.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    aria-pressed={statusFilter === s}
                                    onClick={() => setStatusFilter(s)}
                                    className={cn(
                                        'px-3 h-9 rounded-full text-xs font-semibold capitalize transition-colors',
                                        FOCUS,
                                        statusFilter === s ? 'clay-black' : 'neu-raised-sm text-muted-foreground hover:text-foreground',
                                    )}
                                >{s}</button>
                            ))}
                            <span className="w-px self-stretch bg-border mx-1" aria-hidden="true" />
                            {(['all', 'airtime', 'mashup'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    aria-pressed={typeFilter === t}
                                    onClick={() => setTypeFilter(t)}
                                    className={cn(
                                        'px-3 h-9 rounded-full text-xs font-semibold capitalize transition-colors',
                                        FOCUS,
                                        typeFilter === t ? 'clay-black' : 'neu-raised-sm text-muted-foreground hover:text-foreground',
                                    )}
                                >{t === 'all' ? 'All types' : t}</button>
                            ))}
                        </div>
                    </div>

                    {/* Results */}
                    {ordersLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
                            <p className="text-sm text-muted-foreground">Loading orders</p>
                        </div>
                    ) : ordersFailed ? (
                        <div className="mx-auto max-w-sm space-y-3 py-16 text-center">
                            <Notice>We could not load orders.</Notice>
                            <Button variant="outline" onClick={loadOrders}>Try again</Button>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="neu-inset rounded-3xl py-20 text-center">
                            <Filter className="w-10 h-10 mx-auto mb-3 text-muted-foreground/70 " />
                            <p className="text-sm font-semibold text-foreground">No orders found</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {timePeriod !== 'All'
                                    ? `Nothing in "${timePeriod}". Try "All" to look for an older order.`
                                    : 'Change the filters to see more.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {loadedCount > orders.length && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Showing the latest {orders.length} of {loadedCount} orders. The cards above cover the whole period.
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {filteredOrders.map(order => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        onAction={setSelectedOrder}
                                        onRefund={(o) => setRefundAirtimeOrder(o)}
                                        busy={busyOrderId === order.id || bulkRunning}
                                        selectionMode={selectionMode}
                                        selected={selectedIds.has(order.id)}
                                        onToggleSelect={(o) => setSelectedIds(prev => {
                                            const next = new Set(prev)
                                            if (next.has(o.id)) next.delete(o.id); else next.add(o.id)
                                            return next
                                        })}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Multi-select bulk action bar (sticky) ───────────────────── */}
            {activeTab === 'orders' && selectionMode && selectedIds.size > 0 && (() => {
                const selectedOrders = orders.filter(o => selectedIds.has(o.id))
                const refundIds = selectedOrders.filter(canRefund).map(o => o.id)
                // Complete is available whether the order is still pending or already processing —
                // covers both manual mashup fulfillment and admin-confirmed airtime.
                const completeIds = selectedOrders.filter(o => o.status === 'pending' || o.status === 'processing').map(o => o.id)
                return (
                    <div className="fixed bottom-3 inset-x-0 z-40 px-4 pointer-events-none">
                        <div className="max-w-3xl mx-auto pointer-events-auto neu-raised rounded-3xl p-3">
                            {bulkProgress ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-foreground" role="status">Working: {bulkProgress.done} of {bulkProgress.total}</span>
                                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%` }} />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="text-sm min-w-0 flex-1">
                                        <span className="font-semibold text-foreground">{selectedIds.size} selected</span>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-9" onClick={() => setSelectedIds(new Set(filteredOrders.map(o => o.id)))}>Select all</Button>
                                    <Button size="sm" variant="ghost" className="h-9" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                                    <Button size="sm" variant="outline" className="h-9 gap-1.5" disabled={bulkRunning || completeIds.length === 0} onClick={() => handleBulk('complete', completeIds)}>
                                        <CheckCircle className="w-3.5 h-3.5" /> Complete ({completeIds.length})
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-9 gap-1.5" disabled={bulkRunning || refundIds.length === 0} onClick={() => setRefundBulkConfirm(refundIds)}>
                                        <RefreshCw className="w-3.5 h-3.5" /> Refund ({refundIds.length})
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })()}

            {/* ══ BATCHES TAB ═════════════════════════════════════════════ */}
            {activeTab === 'batches' && (
                <div className="space-y-4">
                    <div className="neu-raised-sm rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-foreground">Fulfillment batches</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Group the pending orders in view and work through them together.
                            </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={loadBatches} disabled={batchesLoading} className="h-9">
                                <RefreshCw className={cn('w-4 h-4 mr-2', batchesLoading && 'animate-spin')} /> Refresh
                            </Button>
                            <Button size="sm" onClick={createBatch} disabled={creatingBatch || filteredOrders.every(o => o.status !== 'pending')} className="h-9">
                                {creatingBatch ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
                                Batch {filteredOrders.filter(o => o.status === 'pending').length} pending
                            </Button>
                        </div>
                    </div>

                    {batchesLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
                            <p className="text-sm text-muted-foreground">Loading batches</p>
                        </div>
                    ) : batches.length === 0 ? (
                        <div className="neu-inset rounded-3xl py-20 text-center">
                            <Database className="w-10 h-10 mx-auto mb-3 text-muted-foreground/70 " />
                            <p className="text-sm font-semibold text-foreground">No batches yet</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Press &ldquo;Batch pending&rdquo; to make one from the orders in view.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {batches.map(batch => {
                                const isComplete = batch.status === 'completed'
                                const isFailed   = batch.status === 'failed'
                                const isPartial  = batch.status === 'partial'
                                const completion = batch.order_count > 0
                                    ? Math.round((batch.completed_count / batch.order_count) * 100)
                                    : 0

                                return (
                                    <div key={batch.id} className="neu-raised-sm rounded-3xl p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                    <span className="text-sm font-semibold text-foreground truncate">{batch.batch_name}</span>
                                                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium uppercase border whitespace-nowrap',
                                                        STATUS_STYLES[batch.status] || 'bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-900',
                                                    )}>
                                                        {batch.status}
                                                    </span>
                                                    {batch.fulfillment_service && (
                                                        <Badge variant="outline" className="text-xs font-medium text-muted-foreground border-border max-w-[10rem] truncate">{batch.fulfillment_service}</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {batch.order_count} orders · {batch.completed_count} completed · {batch.failed_count} failed
                                                    {batch.created_by_user && ` · by ${batch.created_by_user.first_name} ${batch.created_by_user.last_name}`}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(batch.created_at), 'MMM d, yyyy · p')}</p>

                                                {batch.order_count > 0 && (
                                                    <div className="mt-2.5 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn('h-full rounded-full transition-all', isComplete ? 'bg-foreground' : isPartial ? 'bg-brand-600' : 'bg-brand-500')}
                                                            style={{ width: `${completion}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {!isComplete && !isFailed && (
                                                <Button size="sm" onClick={() => completeBatch(batch)} className="h-9 shrink-0">
                                                    <CheckCircle className="w-4 h-4 mr-1.5" /> Mark all done
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══ SETTINGS TAB ════════════════════════════════════════════ */}
            {activeTab === 'settings' && (
                <div className="space-y-4">
                    {settingsLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
                            <p className="text-sm text-muted-foreground">Loading settings</p>
                        </div>
                    ) : !settingsLoaded ? (
                        <div className="mx-auto max-w-sm space-y-3 py-16 text-center">
                            <Notice>We could not load the saved settings. Saving is off so the current fees are not overwritten.</Notice>
                            <Button variant="outline" onClick={loadSettings}>Try again</Button>
                        </div>
                    ) : (
                        <>
                            {/* Inner settings tab switcher */}
                            <div className="neu-inset flex w-fit items-center rounded-full p-1">
                                {(['airtime', 'mashup'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        aria-pressed={activeSettingsTab === t}
                                        onClick={() => setActiveSettingsTab(t)}
                                        className={cn(
                                            'px-4 h-9 rounded-full text-sm font-semibold capitalize transition-colors',
                                            FOCUS,
                                            activeSettingsTab === t ? 'clay-gold' : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2">
                                    <NetworkFeeSection
                                        productType={activeSettingsTab}
                                        settings={settings}
                                        setSettings={setSettings}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <LimitsAndTogglesSection
                                        productType={activeSettingsTab}
                                        settings={settings}
                                        setSettings={setSettings}
                                        savingSettings={savingSettings}
                                        onSave={saveSettings}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Overlays ──────────────────────────────────────────────────── */}
            <ActionModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onSuccess={loadOrders}
            />

            {/* Custom date range dialog */}
            <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
                <DialogContent className="rounded-2xl max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">Custom range</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Select a specific date range to scan orders.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="start" className="text-xs font-medium text-muted-foreground">Start date</Label>
                            <Input id="start" type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="end" className="text-xs font-medium text-muted-foreground">End date</Label>
                            <Input id="end" type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 text-sm" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)} className="h-9 flex-1">Cancel</Button>
                        <Button
                            onClick={() => { setTimePeriod('Custom'); setIsCustomDialogOpen(false) }}
                            className="h-9 flex-1"
                            disabled={!customStart || !customEnd}
                        >
                            Apply filter
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Per-order refund confirmation — controlled, iOS-PWA safe */}
            <Dialog open={!!refundAirtimeOrder} onOpenChange={(o) => { if (!o) setRefundAirtimeOrder(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Refund airtime order?</DialogTitle>
                        <DialogDescription>
                            {refundAirtimeOrder ? `GHS ${Number(refundAirtimeOrder.total_paid).toFixed(2)} · ${refundAirtimeOrder.reference_code}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <p>The buyer&apos;s wallet is credited the amount paid. Completed orders can&apos;t be refunded.</p>
                        {refundAirtimeOrder?.status === 'processing' && (
                            <p className="text-amber-600 dark:text-amber-400">This order is processing and may already be delivered — proceed only if you accept that risk.</p>
                        )}
                        {refundAirtimeOrder?.shop_id && (
                            <p className="text-amber-600 dark:text-amber-400">This is a shop airtime order — refund it from the shop order instead (this will be skipped).</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRefundAirtimeOrder(null)} disabled={bulkRunning}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={bulkRunning}
                            onClick={async () => {
                                const o = refundAirtimeOrder
                                setRefundAirtimeOrder(null)
                                if (o) await handleBulk('refund', [o.id])
                            }}
                        >
                            Refund
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk refund confirmation — controlled, iOS-PWA safe */}
            <Dialog open={!!refundBulkConfirm} onOpenChange={(o) => { if (!o) setRefundBulkConfirm(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Refund {refundBulkConfirm?.length ?? 0} airtime order(s)?</DialogTitle>
                        <DialogDescription>
                            Eligible orders credit the buyer&apos;s wallet. Completed/refunded and shop airtime orders are skipped automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRefundBulkConfirm(null)} disabled={bulkRunning}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={bulkRunning}
                            onClick={async () => {
                                const ids = refundBulkConfirm
                                setRefundBulkConfirm(null)
                                if (ids && ids.length) await handleBulk('refund', ids)
                            }}
                        >
                            Refund
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
