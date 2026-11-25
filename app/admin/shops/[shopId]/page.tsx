'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Store, ArrowLeft, CheckCircle2, XCircle, AlertCircle, Clock,
    ExternalLink, Loader2, Save, Wallet, Tag, MessageCircle,
    Eye, EyeOff, AlertTriangle, BarChart2, TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'

interface ShopDetail {
    id: string
    shop_name: string
    shop_slug: string
    owner_id: string
    approval_status: 'pending' | 'approved' | 'rejected' | 'suspended'
    approval_note: string | null
    pricing_status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected'
    pricing_note: string | null
    is_active: boolean
    fulfillment_mode: 'auto' | 'manual'
    paystack_fee_percent: number | null
    owner_phone: string
    owner_email: string | null
    whatsapp_number: string | null
    created_at: string
    owner?: { first_name: string; last_name: string; email: string; role: string }
}

interface ShopWallet {
    balance: number
    total_earned: number
    total_withdrawn: number
}


interface LivePrice {
    package_id: string
    selling_price: number
    cost: number
    data_packages: { network: string; size: string; price: number; agent_price: number; dealer_price: number }
}

function parseSizeMB(size: string): number {
    const mb = size.match(/(\d+(\.\d+)?)\s*MB/i)
    if (mb) return parseFloat(mb[1])
    const gb = size.match(/(\d+(\.\d+)?)\s*GB/i)
    if (gb) return parseFloat(gb[1]) * 1024
    return 0
}

function networkSortOrder(network: string): number {
    const n = network.toLowerCase()
    if (n.includes('mtn')) return 0
    if (n.includes('telecel')) return 1
    if (n.includes('ishare') || n.includes('at-i')) return 2
    if (n.includes('bigtime') || n.includes('big')) return 3
    if (n.includes('at')) return 4
    return 5
}

const statusConfig = {
    pending: { label: 'Pending', color: 'bg-muted text-foreground', icon: Clock },
    approved: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
    suspended: { label: 'Suspended', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
}

export default function AdminShopDetailPage() {
    const { dbUser, isAdmin } = useAuth()
    const router = useRouter()
    const params = useParams()
    const shopId = params.shopId as string
    const { ask, dialog } = useConfirm()
    const [loadFailed, setLoadFailed] = useState(false)

    const [shop, setShop] = useState<ShopDetail | null>(null)
    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [orderCount, setOrderCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [pricingAction, setPricingAction] = useState<'approving' | 'rejecting' | null>(null)

    const [approvalNote, setApprovalNote] = useState('')
    const [pricingNote, setPricingNote] = useState('')
    const [feeOverride, setFeeOverride] = useState('')
    const [withdrawFeePercent, setWithdrawFeePercent] = useState('')
    const [withdrawFeeFlat, setWithdrawFeeFlat] = useState('')
    const [minWithdrawAmount, setMinWithdrawAmount] = useState('')
    const [fulfillmentMode, setFulfillmentMode] = useState<'auto' | 'manual'>('auto')
    const [isActive, setIsActive] = useState(true)

    const [livePrices, setLivePrices] = useState<LivePrice[]>([])
    const [fetchingPrices, setFetchingPrices] = useState(false)
    const [showLivePrices, setShowLivePrices] = useState(false)
    const [revokingPricing, setRevokingPricing] = useState(false)
    const [revocationNote, setRevocationNote] = useState('')

    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser && shopId) fetchData()
    }, [dbUser, isAdmin, shopId])

    const fetchData = async () => {
        setLoadFailed(false)
        try {
            // Note: wallet is fetched separately after shop loads (owner_id needed)
            const [shopRes, ordersRes] = await Promise.all([
                // Fix: explicit FK to avoid ambiguous relationship error
                (supabase as any).from('shop_profiles')
                    .select('*, owner:users!shop_profiles_owner_id_fkey(first_name, last_name, email, role)')
                    .eq('id', shopId).single(),
                (supabase as any).from('shop_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
            ])

            if (shopRes.error && shopRes.error.code !== 'PGRST116') throw shopRes.error
            if (shopRes.data) {
                const s = shopRes.data
                setShop(s)
                setApprovalNote(s.approval_note || '')
                setPricingNote(s.pricing_note || '')
                setFeeOverride(s.paystack_fee_percent != null ? String(s.paystack_fee_percent) : '')
                setWithdrawFeePercent(s.withdrawal_fee_percent != null ? String(s.withdrawal_fee_percent) : '')
                setWithdrawFeeFlat(s.withdrawal_fee_flat != null ? String(s.withdrawal_fee_flat) : '')
                setMinWithdrawAmount(s.min_withdrawal_amount != null ? String(s.min_withdrawal_amount) : '')
                setFulfillmentMode(s.fulfillment_mode || 'auto')
                setIsActive(s.is_active ?? true)

                // Now fetch wallet by owner_id
                const walletRes2 = await (supabase as any).from('shop_wallets').select('*').eq('owner_id', s.owner_id).single()
                if (walletRes2.data) setWallet(walletRes2.data)
            }
            setOrderCount(ordersRes.count || 0)
        } catch (err) {
            console.error(err)
            setLoadFailed(true)
        } finally {
            setLoading(false)
        }
    }

    // Status writes go through the service-role route: the protect_shop_admin_columns
    // trigger silently reverts approval_status / is_active when written from the browser,
    // even by an admin (F16).
    const shopAction = async (body: Record<string, unknown>) => {
        const res = await fetch('/api/admin/shops', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shopId, ...body }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.success === false) throw new Error(json.error || 'That did not work.')
    }

    const updateApproval = async (status: 'approved' | 'rejected' | 'suspended') => {
        if (status !== 'approved') {
            const ok = await ask({
                title: status === 'suspended' ? `Suspend ${shop?.shop_name ?? 'this shop'}?` : `Reject ${shop?.shop_name ?? 'this shop'}?`,
                description: 'The shop goes offline and the owner is told. You can approve it again later.',
                confirmLabel: status === 'suspended' ? 'Suspend shop' : 'Reject shop',
                destructive: true,
            })
            if (!ok) return
        }
        setSaving(true)
        try {
            await shopAction({ status, note: approvalNote.trim() })
            toast.success(status === 'approved' ? 'Shop approved' : status === 'suspended' ? 'Shop suspended' : 'Shop rejected')
            fetchData()

            // Alerts 5 & 6 — profile approved/rejected SMS + Email (non-blocking)
            if ((status === 'approved' || status === 'rejected') && shop && owner) {
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: status === 'approved' ? 'profile_approved' : 'profile_rejected',
                        payload: {
                            phone: shop.owner_phone,
                            firstName: owner.first_name,
                            email: owner.email,
                            shopName: shop.shop_name,
                            reason: status === 'rejected' ? (approvalNote.trim() || 'Please check your dashboard for details.') : undefined,
                        },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }
        } catch (err: any) {
            toast.error(err.message || 'Could not update the shop. Try again.')
        } finally {
            setSaving(false)
        }
    }

    const approvePricing = async () => {
        setPricingAction('approving')
        try {
            // The owner's submitted prices are already the shop's price list (the pricing
            // route saves them and keeps the shop offline while in review) — approving
            // publishes them and brings the shop online.
            await shopAction({ action: 'approve_pricing' })

            toast.success('Prices approved. The shop is live.')
            fetchData()

            // Alert 3 — SMS + Email to owner (non-blocking)
            if (shop && owner) {
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'pricing_approved',
                        payload: { phone: shop.owner_phone, firstName: owner.first_name, email: owner.email, shopName: shop.shop_name },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }
        } catch (err: any) {
            toast.error(err.message || 'Could not approve the prices. Try again.')
        } finally {
            setPricingAction(null)
        }
    }

    const rejectPricing = async () => {
        if (!pricingNote.trim()) {
            toast.error('Write a note so the owner knows what to change.')
            return
        }
        setPricingAction('rejecting')
        try {
            await shopAction({ action: 'reject_pricing', note: pricingNote.trim() })
            toast.success('Prices rejected. The owner is told.')
            fetchData()

            // Alert 4 — SMS + Email to owner (non-blocking)
            if (shop && owner) {
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'pricing_rejected',
                        payload: { phone: shop.owner_phone, firstName: owner.first_name, email: owner.email, shopName: shop.shop_name, reason: pricingNote.trim() },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }
        } catch (err: any) {
            toast.error(err.message || 'Could not reject the prices. Try again.')
        } finally {
            setPricingAction(null)
        }
    }

    const fetchLivePrices = async () => {
        if (showLivePrices) {
            setShowLivePrices(false)
            return
        }
        setFetchingPrices(true)
        try {
            // Server route (not a direct client query): cost must be resolved via the
            // same resolveOwnerCost/resolveSubAgentDataCost functions the real order
            // processor uses, including sub-agent recruiter-cost+markup — logic that
            // needs service-role DB access and can't run safely in the browser.
            const res = await fetch(`/api/admin/shop/${shopId}/live-pricing`)
            const json = await res.json()
            if (!res.ok || json.success === false) throw new Error(json.error || 'Could not load the live prices.')
            const data = json.data
            const sorted = ((data || []) as LivePrice[]).sort((a, b) => {
                const netA = networkSortOrder(a.data_packages?.network || '')
                const netB = networkSortOrder(b.data_packages?.network || '')
                if (netA !== netB) return netA - netB
                return parseSizeMB(a.data_packages?.size || '') - parseSizeMB(b.data_packages?.size || '')
            })
            setLivePrices(sorted)
            setShowLivePrices(true)
        } catch (err: any) {
            toast.error(err.message || 'Could not load the live prices. Try again.')
        } finally {
            setFetchingPrices(false)
        }
    }

    const revokeLivePricing = async () => {
        if (!revocationNote.trim()) {
            toast.error('Write a reason so the owner knows what to change.')
            return
        }
        const ok = await ask({
            title: 'Take down this shop\'s prices?',
            description: 'All live prices are cleared and the shop goes offline until the owner submits prices again.',
            confirmLabel: 'Revoke prices',
            destructive: true,
        })
        if (!ok) return
        setRevokingPricing(true)
        try {
            await shopAction({ action: 'revoke_pricing', note: revocationNote.trim() })
            if (shop && owner) {
                fetch('/api/shop/alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'pricing_rejected',
                        payload: {
                            phone: shop.owner_phone,
                            firstName: owner.first_name,
                            email: owner.email,
                            shopName: shop.shop_name,
                            reason: revocationNote.trim(),
                        },
                    }),
                }).catch(err => console.warn('[ShopAlert]', err))
            }
            toast.success('Prices revoked. The shop is offline.')
            setShowLivePrices(false)
            setLivePrices([])
            setRevocationNote('')
            fetchData()
        } catch (err: any) {
            toast.error(err.message || 'Could not revoke the prices. Try again.')
        } finally {
            setRevokingPricing(false)
        }
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            // Fee override parsing rule:
            // - Blank ("") → null  → means "Inherit from Global Settings for this shop's owner role"
            // - "0"        → 0     → means "Deliberately free for this shop"
            // - any number → that exact number as an override
            const parseOverride = (val: string): number | null => {
                const trimmed = val.trim()
                if (trimmed === '') return null
                return Number(trimmed)
            }
            const bounds: [string, string, number][] = [
                ['Paystack fee', feeOverride, 10],
                ['Withdrawal fee', withdrawFeePercent, 50],
                ['Withdrawal flat fee', withdrawFeeFlat, 1000],
                ['Smallest withdrawal', minWithdrawAmount, 100000],
            ]
            for (const [label, val, max] of bounds) {
                if (val.trim() === '') continue
                const n = Number(val)
                if (!Number.isFinite(n) || n < 0 || n > max) {
                    toast.error(`${label} must be a number from 0 to ${max}, or left blank to use the default.`)
                    return
                }
            }

            // Use the server-side API route which uses the service role client.
            // This bypasses the security trigger that protects fee columns from
            // being modified by shop owners via the browser client.
            const res = await fetch(`/api/admin/shop/${shopId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fulfillment_mode:       fulfillmentMode,
                    is_active:              isActive,
                    paystack_fee_percent:   parseOverride(feeOverride),
                    withdrawal_fee_percent: parseOverride(withdrawFeePercent),
                    withdrawal_fee_flat:    parseOverride(withdrawFeeFlat),
                    min_withdrawal_amount:  parseOverride(minWithdrawAmount),
                }),
            })
            const result = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(result.error || 'Could not save the settings.')
            toast.success('Settings saved')
            fetchData()
        } catch (err: any) {
            toast.error(err.message || 'Could not save the settings. Try again.')
        } finally {
            setSaving(false)
        }
    }


    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
            </div>
        )
    }

    if (loadFailed) {
        return (
            <div role="alert" className="max-w-md neu-raised-sm rounded-3xl p-6 space-y-3">
                <p className="font-display text-base font-semibold">Could not load this shop</p>
                <p className="text-sm text-muted-foreground">Check your connection, then try again.</p>
                <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData() }}>Try again</Button>
            </div>
        )
    }

    if (!shop) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">This shop doesn't exist.</p>
                <Link href="/admin/shops"><Button variant="outline" className="mt-4">Back to shops</Button></Link>
            </div>
        )
    }

    const owner = shop.owner as any
    const cfg = statusConfig[shop.approval_status]
    const Icon = cfg.icon

    return (
        <div className="space-y-6 max-w-3xl">
            {dialog}
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/admin/shops">
                    <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Back to shops">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="font-display text-xl font-bold flex items-center gap-2">
                        <Store className="w-5 h-5 text-brand-700 dark:text-brand-500" />
                        {shop.shop_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                        </span>
                        <a href={`/shop/${shop.shop_slug}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                            /shop/{shop.shop_slug} <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Owner info + WhatsApp */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Owner</CardTitle>
                        {shop.whatsapp_number && (
                            <a
                                href={`https://wa.me/${shop.whatsapp_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button size="sm" className="h-9 text-xs clay-silver gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Message on WhatsApp
                                </Button>
                            </a>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{[owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || 'Unnamed owner'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{owner?.email}</p></div>
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{shop.owner_phone}</p></div>
                    <div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="font-medium">{shop.whatsapp_number || '—'}</p></div>
                    <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(shop.created_at).toLocaleDateString()}</p></div>
                    <div><p className="text-xs text-muted-foreground">Orders</p><p className="font-medium">{orderCount}</p></div>
                </CardContent>
            </Card>

            {/* Profit Wallet */}
            <Card className="overflow-hidden border-0">
                <div className="neu-raised-sm rounded-3xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        <p className="text-muted-foreground text-sm font-medium">Shop profit wallet</p>
                    </div>
                    <p className="text-3xl font-bold">{formatCurrency(wallet?.balance || 0)}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Earned: {formatCurrency(wallet?.total_earned || 0)}</span>
                        <span>Withdrawn: {formatCurrency(wallet?.total_withdrawn || 0)}</span>
                    </div>
                </div>
            </Card>

            {/* Stage 2: Pricing Review Panel */}
            {shop.approval_status === 'approved' && shop.pricing_status === 'pending_review' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            Prices waiting for your review
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            The owner submitted new prices and the shop is offline until you decide. Open <strong>View live prices</strong> below to check them, then approve or reject.
                        </p>

                        {/* Rejection note */}
                        <div>
                            <Label htmlFor="pricing_note">Note to the owner (needed to reject)</Label>
                            <Textarea
                                id="pricing_note"
                                value={pricingNote}
                                onChange={(e) => setPricingNote(e.target.value)}
                                placeholder="Say what to change so the owner can resubmit…"
                                rows={2}
                                className="mt-1"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={approvePricing}
                                disabled={!!pricingAction}
                                className="gap-1.5 clay-black"
                            >
                                {pricingAction === 'approving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Approve prices
                            </Button>
                            <Button
                                onClick={rejectPricing}
                                disabled={!!pricingAction}
                                variant="outline"
                                className="border-red-500 text-red-600 hover:bg-red-50 gap-1.5"
                            >
                                {pricingAction === 'rejecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                Reject prices
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Live Pricing Viewer */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart2 className="w-4 h-4" />
                            Live prices
                        </CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchLivePrices}
                            disabled={fetchingPrices}
                            className="h-9 text-xs gap-1.5"
                        >
                            {fetchingPrices ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : showLivePrices ? (
                                <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                                <Eye className="w-3.5 h-3.5" />
                            )}
                            {showLivePrices ? 'Hide live prices' : 'View live prices'}
                        </Button>
                    </div>
                </CardHeader>

                {showLivePrices && (
                    <CardContent className="space-y-4">
                        {livePrices.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">This shop has no live prices.</p>
                        ) : (() => {
                            const totalPkg = livePrices.length
                            const avgProfit = livePrices.reduce((sum, p) => {
                                return sum + (p.selling_price - p.cost)
                            }, 0) / totalPkg

                            return (
                                <>
                                    {/* Summary Metrics Bar */}
                                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted">
                                        <div className="flex items-center gap-1.5">
                                            <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">Packages:</span>
                                            <span className="text-xs font-semibold text-foreground">{totalPkg}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">Average profit:</span>
                                            <span className={cn('text-xs font-bold', avgProfit > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600')}>
                                                {avgProfit > 0 ? '+' : ''}{formatCurrency(avgProfit)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Pricing Table */}
                                    <div className="rounded-lg border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-muted/50 border-b text-xs text-muted-foreground">
                                                    <th className="text-left px-3 py-2 font-medium">Package</th>
                                                    <th className="text-right px-3 py-2 font-medium">Cost</th>
                                                    <th className="text-right px-3 py-2 font-medium">Selling</th>
                                                    <th className="text-right px-3 py-2 font-medium">Profit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {livePrices.map(p => {
                                                    const pkg = p.data_packages as any
                                                    const cost = p.cost
                                                    const profit = p.selling_price - cost
                                                    const hasWarning = profit <= 0
                                                    return (
                                                        <tr
                                                            key={p.package_id}
                                                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                                                        >
                                                            <td className="px-3 py-2 font-medium">{pkg?.network} {pkg?.size}</td>
                                                            <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(cost)}</td>
                                                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.selling_price)}</td>
                                                            <td className={cn('px-3 py-2 text-right font-bold', hasWarning ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400')}>
                                                                <span className="flex items-center justify-end gap-1">
                                                                    {hasWarning && <AlertTriangle className="w-3 h-3" />}
                                                                    {profit > 0 ? '+' : ''}{formatCurrency(profit)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Revoke Live Pricing */}
                                    <div className="space-y-2 pt-2 border-t">
                                        <p className="text-xs font-semibold text-red-600">Revoke live prices</p>
                                        <p className="text-xs text-muted-foreground">This clears every live price, takes the shop offline and tells the owner to submit prices again.</p>
                                        <div>
                                            <Label htmlFor="revocation_note">Reason for the owner (required)</Label>
                                            <Textarea
                                                id="revocation_note"
                                                value={revocationNote}
                                                onChange={(e) => setRevocationNote(e.target.value)}
                                                placeholder="Say why the prices were revoked…"
                                                rows={2}
                                                className="mt-1"
                                            />
                                        </div>
                                        <Button
                                            onClick={revokeLivePricing}
                                            disabled={revokingPricing}
                                            variant="outline"
                                            className="border-red-500 text-red-600 hover:bg-red-50 gap-1.5"
                                        >
                                            {revokingPricing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                            Revoke live prices
                                        </Button>
                                    </div>
                                </>
                            )
                        })()}
                    </CardContent>
                )}
            </Card>

            {/* Approval Controls */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Shop approval</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="approval_note">Note to the owner</Label>
                        <Textarea
                            id="approval_note"
                            value={approvalNote}
                            onChange={(e) => setApprovalNote(e.target.value)}
                            placeholder="The reason, or a message with the approval…"
                            rows={2}
                            className="mt-1"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => updateApproval('approved')}
                            disabled={saving || shop.approval_status === 'approved'}
                            className="gap-1.5 clay-black"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Approve shop
                        </Button>
                        <Button
                            onClick={() => updateApproval('suspended')}
                            disabled={saving || shop.approval_status === 'suspended'}
                            variant="outline"
                            className="border-orange-500 text-orange-600 hover:bg-orange-50 gap-1.5"
                        >
                            <AlertCircle className="w-4 h-4" /> Suspend
                        </Button>
                        <Button
                            onClick={() => updateApproval('rejected')}
                            disabled={saving || shop.approval_status === 'rejected'}
                            variant="outline"
                            className="border-red-500 text-red-600 hover:bg-red-50 gap-1.5"
                        >
                            <XCircle className="w-4 h-4" /> Reject shop
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Shop Settings */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Shop settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <p className="text-sm font-medium">Shop is visible</p>
                            <p className="text-xs text-muted-foreground">Hide the shop without changing its approval</p>
                        </div>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <p className="text-sm font-medium">Fulfil orders automatically</p>
                            <p className="text-xs text-muted-foreground">Uses a connected supplier. None is set up yet, so orders wait for manual fulfilment either way.</p>
                        </div>
                        <Switch
                            checked={fulfillmentMode === 'auto'}
                            onCheckedChange={(v) => setFulfillmentMode(v ? 'auto' : 'manual')}
                        />
                    </div>

                    <div>
                        <Label htmlFor="fee_override">Paystack fee for this shop (%)</Label>
                        <Input
                            id="fee_override"
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            value={feeOverride}
                            onChange={(e) => setFeeOverride(e.target.value)}
                            placeholder="Blank uses the default"
                            className="mt-1 max-w-xs"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Leave blank to use the default for this owner's role. Enter <strong>0</strong> to waive the fee for this shop.
                        </p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 border border-dashed text-xs text-muted-foreground mb-1">
                        Blank uses the default from Shop settings for the owner's role. <strong>0</strong> waives the fee for this shop.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="withdraw_fee_percent">Withdrawal fee for this shop (%)</Label>
                            <Input
                                id="withdraw_fee_percent"
                                type="number"
                                min="0"
                                max="50"
                                step="0.1"
                                value={withdrawFeePercent}
                                onChange={(e) => setWithdrawFeePercent(e.target.value)}
                                placeholder="Blank uses the default"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="withdraw_fee_flat">Withdrawal flat fee for this shop (GH₵)</Label>
                            <Input
                                id="withdraw_fee_flat"
                                type="number"
                                min="0"
                                step="0.01"
                                value={withdrawFeeFlat}
                                onChange={(e) => setWithdrawFeeFlat(e.target.value)}
                                placeholder="Blank uses the default"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="min_withdraw">Smallest withdrawal for this shop (GH₵)</Label>
                            <Input
                                id="min_withdraw"
                                type="number"
                                min="0"
                                step="0.01"
                                value={minWithdrawAmount}
                                onChange={(e) => setMinWithdrawAmount(e.target.value)}
                                placeholder="Blank uses the default"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <Button onClick={saveSettings} disabled={saving} className="gap-2 clay-black">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save settings
                    </Button>
                </CardContent>
            </Card>

        </div>
    )
}
