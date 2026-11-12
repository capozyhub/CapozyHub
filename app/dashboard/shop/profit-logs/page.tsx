'use client'

import { Pager, usePaged } from '@/components/shop/pager'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import {
    AlertCircle, ArrowDownLeft, ArrowLeft, ArrowRightLeft, ArrowUpRight, BarChart3,
    Package, Phone, FileText, IdCard, MessageSquare, Zap, Receipt, RefreshCw, RotateCcw,
} from 'lucide-react'
import { toast } from '@/lib/toast'

type EntryType =
    | 'data' | 'airtime' | 'rc' | 'afa' | 'withdrawal' | 'sms_bundle' | 'sms_activation'
    | 'utility_commission' | 'refund_reversal' | 'commission_transfer'

interface LedgerEntry {
    id: string
    kind: 'credit' | 'debit'
    entryType: EntryType
    label: string
    detail: string
    amount: number
    status: string
    created_at: string
    balanceAfter: number
}

interface ShopWallet {
    id?: string
    balance: number
    total_earned: number
    total_withdrawn: number
}

type DateFilter = 'today' | '7d' | '30d' | 'all'
type KindFilter = 'all' | 'credit' | 'withdrawal' | 'sms'

// Profit is credited at payment time and is never reversed on 'failed' or 'refunded' — the shop
// owner keeps their margin either way (see lib/refund-service.ts) — so those statuses stay visible
// here too, instead of the credit silently vanishing from the owner's own ledger.
const EARNING_STATUSES = ['pending', 'processing', 'completed', 'failed', 'refunded']

const ENTRY_ICON: Record<EntryType, React.ElementType> = {
    data: Package,
    airtime: Phone,
    rc: FileText,
    afa: IdCard,
    withdrawal: ArrowUpRight,
    sms_bundle: MessageSquare,
    sms_activation: Zap,
    utility_commission: Receipt,
    refund_reversal: RotateCcw,
    commission_transfer: ArrowRightLeft,
}

const isSmsEntry = (e: { entryType: EntryType }) => e.entryType === 'sms_bundle' || e.entryType === 'sms_activation'

// A withdrawal debits the wallet the moment it is requested (so in-flight ones already count),
// and a 'reversed' one gives the money back. Only the reversed ones must not move the balance.
const movesBalance = (e: { entryType: EntryType; status: string }) =>
    !((e.entryType === 'withdrawal' || e.entryType === 'refund_reversal') && e.status === 'reversed')

function statusChip(entry: { kind: 'credit' | 'debit'; status: string }): { label: string; className: string } {
    const s = entry.status
    if (s === 'reversed') return { label: 'Returned to wallet', className: 'bg-foreground/10 text-muted-foreground' }
    if (s === 'pending' || s === 'processing' || s.endsWith('_pending')) return { label: 'In progress', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500' }
    if (s === 'failed' || s === 'rejected') {
        return { label: entry.kind === 'credit' ? 'Order failed, profit kept' : 'Failed', className: 'bg-red-500/15 text-red-600 dark:text-red-400' }
    }
    if (s === 'refunded') return { label: 'Refunded, profit kept', className: 'bg-foreground/10 text-muted-foreground' }
    return { label: 'Done', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' }
}

export default function ShopProfitLogsPage() {
    const [allEntries, setAllEntries] = useState<LedgerEntry[]>([])
    const [wallet, setWallet] = useState<ShopWallet | null>(null)
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    const [incomplete, setIncomplete] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [filterDate, setFilterDate] = useState<DateFilter>('30d')
    const [kindFilter, setKindFilter] = useState<KindFilter>('all')

    const fetchData = useCallback(async (): Promise<boolean> => {
        setFailed(false)
        try {
            const res = await fetch('/api/shop/profit-logs', { cache: 'no-store' })
            const json = await res.json().catch(() => null)
            if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load profit logs')

            const { wallet: walletRow, orders, rcOrders, afaOrders, withdrawals, smsPurchases, smsActs, utilityCommissions } = json.data

            if (walletRow) setWallet(walletRow)
            setIncomplete(!!json.data.incomplete)

            // Refund claw-backs and commission transfers also move this wallet but are not in the
            // API payload, so without them every "balance after" figure drifted. They are optional
            // extras: if this read fails the ledger still renders from the main payload.
            let walletMoves: any[] = []
            if (walletRow?.id) {
                try {
                    const { rows } = await fetchAllRows(() => (supabase.from('shop_wallet_transactions') as any)
                        .select('id, type, amount, status, created_at')
                        .eq('shop_wallet_id', walletRow.id)
                        .in('type', ['profit_reversal', 'commission_transfer_in'])
                        .order('created_at', { ascending: false })
                        .order('id', { ascending: false }))
                    walletMoves = rows
                } catch { /* optional */ }
            }

            const raw: Omit<LedgerEntry, 'balanceAfter'>[] = [
                ...orders
                    .filter((o: any) => EARNING_STATUSES.includes(o.status) && (o.profit || 0) > 0)
                    .map((o: any) => ({
                        id: `ord-${o.id}`,
                        kind: 'credit' as const,
                        entryType: (o.package_id == null ? 'airtime' : 'data') as EntryType,
                        label: o.package_id == null ? `${o.network} airtime` : `${o.network} ${o.package_size}`,
                        detail: o.guest_phone || '',
                        amount: o.profit || 0,
                        status: o.status,
                        created_at: o.created_at,
                    })),
                ...rcOrders
                    .filter((o: any) => EARNING_STATUSES.includes(o.status) && (o.shop_markup || 0) > 0)
                    .map((o: any) => ({
                        id: `rc-${o.id}`,
                        kind: 'credit' as const,
                        entryType: 'rc' as EntryType,
                        label: `${o.quantity}× ${o.type_name}`,
                        detail: o.customer_phone || '',
                        amount: (o.shop_markup || 0) * (o.quantity || 1),
                        status: o.status,
                        created_at: o.created_at,
                    })),
                ...(afaOrders || [])
                    .filter((o: any) => EARNING_STATUSES.includes(o.status) && (o.profit || 0) > 0)
                    .map((o: any) => ({
                        id: `afa-${o.id}`,
                        kind: 'credit' as const,
                        entryType: 'afa' as EntryType,
                        label: 'AFA registration',
                        detail: o.phone || '',
                        amount: o.profit || 0,
                        status: o.status,
                        created_at: o.created_at,
                    })),
                ...withdrawals.map((w: any) => ({
                    id: `wd-${w.id}`,
                    kind: 'debit' as const,
                    entryType: 'withdrawal' as EntryType,
                    label: 'Withdrawal',
                    detail: [w.account_name, w.momo_number, w.fee ? `fee ${formatCurrency(w.fee)}` : ''].filter(Boolean).join(' · '),
                    amount: w.amount || 0,
                    status: w.status,
                    created_at: w.created_at,
                })),
                ...smsPurchases.map((s: any) => ({
                    id: `sms-${s.id}`,
                    kind: 'debit' as const,
                    entryType: 'sms_bundle' as EntryType,
                    label: s.shop_sms_bundles?.name || 'SMS bundle',
                    detail: `${s.credits} credits bought`,
                    amount: s.price || 0,
                    status: 'completed',
                    created_at: s.created_at,
                })),
                ...smsActs.map((a: any) => ({
                    id: `smsact-${a.id}`,
                    kind: 'debit' as const,
                    entryType: 'sms_activation' as EntryType,
                    label: 'SMS activation',
                    detail: 'One-time unlock fee',
                    amount: a.amount_paid || 0,
                    status: 'completed',
                    created_at: a.created_at,
                })),
                ...(utilityCommissions || []).map((c: any) => ({
                    id: `utilcomm-${c.id}`,
                    kind: 'credit' as const,
                    entryType: 'utility_commission' as EntryType,
                    label: 'Utility bill commission',
                    detail: c.description || '',
                    amount: c.amount || 0,
                    status: 'completed',
                    created_at: c.created_at,
                })),
                ...walletMoves
                    .filter((m: any) => (m.amount || 0) > 0)
                    .map((m: any) => m.type === 'profit_reversal'
                        ? {
                            id: `rev-${m.id}`,
                            kind: 'debit' as const,
                            entryType: 'refund_reversal' as EntryType,
                            label: 'Refund took back profit',
                            detail: 'A customer was refunded, so the profit on that sale was returned',
                            amount: m.amount,
                            status: m.status || 'completed',
                            created_at: m.created_at,
                        }
                        : {
                            id: `xfer-${m.id}`,
                            kind: 'credit' as const,
                            entryType: 'commission_transfer' as EntryType,
                            label: 'Moved from commission',
                            detail: 'Transfer from your commission wallet',
                            amount: m.amount,
                            status: m.status || 'completed',
                            created_at: m.created_at,
                        }),
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

            // Running balance, walked backwards from the real wallet balance.
            // Newest entry: balanceAfter = current balance. Each step back undoes that entry's
            // effect, but only entries that actually moved the balance (see movesBalance).
            let rb = walletRow?.balance ?? 0
            const withBalance: LedgerEntry[] = raw.map(entry => {
                const balanceAfter = rb
                if (movesBalance(entry)) rb = entry.kind === 'credit' ? rb - entry.amount : rb + entry.amount
                return { ...entry, balanceAfter }
            })

            setAllEntries(withBalance)
            return true
        } catch (err) {
            console.error('[ProfitLogs]', err)
            setFailed(true)
            return false
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const handleRefresh = async () => {
        setIsRefreshing(true)
        const ok = await fetchData()
        setIsRefreshing(false)
        if (ok) toast.success('Up to date')
        else toast.error('Could not refresh your profit logs')
    }

    // ── Filtering (client-side after the first fetch) ──────────────────────────
    const floor: number | null = (() => {
        if (filterDate === 'today') return new Date().setHours(0, 0, 0, 0)
        if (filterDate === '7d') return Date.now() - 7 * 86400000
        if (filterDate === '30d') return Date.now() - 30 * 86400000
        return null
    })()

    const periodEntries = useMemo(
        () => allEntries.filter(e => !floor || new Date(e.created_at).getTime() >= floor),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allEntries, filterDate],
    )

    const visible = periodEntries.filter(e => {
        if (kindFilter === 'credit') return e.kind === 'credit'
        if (kindFilter === 'withdrawal') return e.entryType === 'withdrawal'
        if (kindFilter === 'sms') return isSmsEntry(e)
        return true
    })

    const paged = usePaged(visible, `${filterDate}|${kindFilter}`)

    // Money that went back to the wallet (reversed) is neither earned nor spent.
    const counted = periodEntries.filter(movesBalance)
    const periodEarned = counted.filter(e => e.kind === 'credit').reduce((s, e) => s + e.amount, 0)
    const periodWithdrawn = counted.filter(e => e.entryType === 'withdrawal').reduce((s, e) => s + e.amount, 0)
    const periodSmsSpend = counted.filter(isSmsEntry).reduce((s, e) => s + e.amount, 0)
    const periodRefunded = counted.filter(e => e.entryType === 'refund_reversal').reduce((s, e) => s + e.amount, 0)
    const periodNet = periodEarned - periodWithdrawn - periodSmsSpend - periodRefunded
    const hasSms = allEntries.some(isSmsEntry)

    if (loading) {
        return (
            <div className="space-y-5" aria-busy="true" aria-label="Loading your profit logs">
                <div className="neu-raised-sm h-24 rounded-3xl" />
                <div className="neu-raised-sm h-44 rounded-3xl" />
                <div className="neu-raised-sm h-96 rounded-3xl" />
            </div>
        )
    }

    if (failed && allEntries.length === 0) {
        return (
            <div className="neu-raised-sm mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-3xl p-8 text-center">
                <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-red-500"><AlertCircle className="h-6 w-6" /></span>
                <h1 className="font-display text-lg font-semibold">We couldn&apos;t load your profit logs</h1>
                <p className="text-sm text-muted-foreground">Check your connection and try again. Your balance is safe.</p>
                <button type="button" onClick={() => { setLoading(true); fetchData() }} className="clay-gold inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold">
                    <RefreshCw className="h-4 w-4" /> Try again
                </button>
            </div>
        )
    }

    const segment = (active: boolean) => cn(
        'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        active ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground'
    )

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <Link href="/dashboard/shop" className="mb-2 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <ArrowLeft className="h-3.5 w-3.5" /> My shop
                    </Link>
                    <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Profit logs</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Everything you earned, withdrew or spent, with your balance after each one.</p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="clay-silver inline-flex h-10 w-fit flex-shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
                >
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} /> Refresh
                </button>
            </header>

            {incomplete && (
                <div className="neu-inset flex items-start gap-3 rounded-2xl p-4 text-xs text-muted-foreground" role="status">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700 dark:text-brand-500" />
                    You have a very long history, so the oldest entries may be missing and the balance column may be off for them.
                </div>
            )}

            {failed && (
                <div className="neu-inset flex items-start gap-3 rounded-2xl p-4 text-xs text-muted-foreground" role="status">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    The last refresh did not work, so this may be out of date.
                </div>
            )}

            {/* ── Balance hero ── */}
            <section aria-label="Profit balance" className="neu-night relative overflow-hidden rounded-3xl p-5 text-white sm:p-7">
                <p className="text-xs font-medium text-white/50">Profit balance</p>
                <p className="mt-1 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                    <span className="mr-1.5 text-2xl font-semibold text-brand-500 sm:text-3xl">GH₵</span>
                    {Number(wallet?.balance ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="neu-night-in mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-2.5 text-sm text-white/70">
                    <span>Earned <span className="font-semibold text-white">{formatCurrency(wallet?.total_earned ?? 0)}</span></span>
                    <span className="text-white/30">/</span>
                    <span>Withdrawn <span className="font-semibold text-white">{formatCurrency(wallet?.total_withdrawn ?? 0)}</span></span>
                </div>
            </section>

            {/* ── Filters ── */}
            <div className="flex flex-wrap items-center gap-3">
                <div role="group" aria-label="Period" className="neu-inset flex max-w-full overflow-x-auto rounded-xl p-1">
                    {(['today', '7d', '30d', 'all'] as const).map(f => (
                        <button key={f} type="button" onClick={() => setFilterDate(f)} aria-pressed={filterDate === f} className={segment(filterDate === f)}>
                            {f === 'today' ? 'Today' : f === '7d' ? '7 days' : f === '30d' ? '30 days' : 'All time'}
                        </button>
                    ))}
                </div>
                <div role="group" aria-label="Type" className="neu-inset flex max-w-full overflow-x-auto rounded-xl p-1">
                    {([
                        { id: 'all', label: 'Everything' },
                        { id: 'credit', label: 'Earnings' },
                        { id: 'withdrawal', label: 'Withdrawals' },
                        ...(hasSms ? [{ id: 'sms', label: 'SMS' }] : []),
                    ] as const).map(f => (
                        <button key={f.id} type="button" onClick={() => setKindFilter(f.id as KindFilter)} aria-pressed={kindFilter === f.id} className={segment(kindFilter === f.id)}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Period summary ── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Earned', value: formatCurrency(periodEarned), tone: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Withdrawn', value: formatCurrency(periodWithdrawn), tone: 'text-foreground' },
                    { label: 'Net', value: `${periodNet >= 0 ? '+' : '-'}${formatCurrency(Math.abs(periodNet))}`, tone: periodNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
                ].map(t => (
                    <div key={t.label} className="neu-raised-sm rounded-2xl p-3.5">
                        <p className="text-[11px] font-medium text-muted-foreground">{t.label}</p>
                        <p className={cn('mt-1 truncate text-sm font-bold tabular-nums sm:text-lg', t.tone)}>{t.value}</p>
                    </div>
                ))}
            </div>
            <p className="-mt-2 px-1 text-[11px] text-muted-foreground">
                Net is what you earned minus withdrawals{hasSms ? ', SMS spending' : ''}{periodRefunded > 0 ? ' and refunds' : ''} in this period.
                {hasSms && <> SMS spending this period: <span className="font-semibold text-foreground">{formatCurrency(periodSmsSpend)}</span>.</>}
            </p>

            {/* ── Ledger ── */}
            <section aria-label="Ledger" className="neu-raised-sm rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 px-1">
                    <h2 className="font-display text-lg font-semibold">Ledger</h2>
                    {visible.length > 0 && (
                        <span className="text-xs text-muted-foreground">{visible.length} {visible.length === 1 ? 'entry' : 'entries'}</span>
                    )}
                </div>

                {visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                        <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground"><BarChart3 className="h-5 w-5" /></span>
                        <p className="text-sm font-medium">Nothing matches these filters</p>
                        <p className="text-xs text-muted-foreground">Try a longer period or a different type.</p>
                    </div>
                ) : (
                    <ul className="mt-2 divide-y divide-border">
                        {paged.visible.map((entry) => {
                            const EntryIcon = ENTRY_ICON[entry.entryType]
                            const isCredit = entry.kind === 'credit'
                            const chip = statusChip(entry)
                            const returned = entry.status === 'reversed'

                            return (
                                <li key={entry.id} className="flex items-start justify-between gap-3 px-1 py-3.5">
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <span className="neu-inset mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-brand-700 dark:text-brand-500">
                                            <EntryIcon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold leading-tight">{entry.label}</p>
                                            {entry.detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</p>}
                                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                <p className="text-[11px] text-muted-foreground">
                                                    {new Date(entry.created_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    {' · '}
                                                    {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', chip.className)}>{chip.label}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-shrink-0 text-right">
                                        <p className={cn(
                                            'flex items-center justify-end gap-1 text-sm font-bold tabular-nums',
                                            returned ? 'text-muted-foreground line-through' : isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                                        )}>
                                            {isCredit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                            {isCredit ? '+' : '-'}{formatCurrency(entry.amount)}
                                        </p>
                                        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">balance {formatCurrency(entry.balanceAfter)}</p>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
                <Pager page={paged.page} pages={paged.pages} size={paged.size} total={paged.total} onPage={paged.setPage} onSize={paged.setSize} />
            </section>

            {visible.length > 0 && (
                <p className="px-4 text-center text-[11px] text-muted-foreground">
                    &ldquo;Balance&rdquo; is your profit wallet right after that entry, worked back from today&apos;s balance of <strong className="text-foreground">{formatCurrency(wallet?.balance ?? 0)}</strong>.
                </p>
            )}
        </div>
    )
}
