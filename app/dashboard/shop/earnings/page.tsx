'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { Pager, usePaged } from '@/components/shop/pager'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import {
    AlertCircle, ArrowDownRight, ArrowLeft, ArrowRightLeft, Download, Inbox,
    RefreshCw, RotateCcw, TrendingUp, Wallet,
} from 'lucide-react'

// Every movement in the shop wallet: profit credits, withdrawals, refund reversals
// (profit_reversal) and transfers in from commission.

type TypeKey = 'profit' | 'withdrawal' | 'profit_reversal' | 'commission_transfer_in'
type Filter = 'all' | TypeKey

const TYPE_META: Record<string, { label: string; sign: '+' | '-'; tone: string; Icon: typeof Wallet }> = {
    profit: { label: 'Sale profit', sign: '+', tone: 'text-emerald-600 dark:text-emerald-400', Icon: TrendingUp },
    withdrawal: { label: 'Withdrawal', sign: '-', tone: 'text-foreground', Icon: ArrowDownRight },
    profit_reversal: { label: 'Refund took back profit', sign: '-', tone: 'text-red-600 dark:text-red-400', Icon: RotateCcw },
    commission_transfer_in: { label: 'Moved from commission', sign: '+', tone: 'text-emerald-600 dark:text-emerald-400', Icon: ArrowRightLeft },
}

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Everything' },
    { id: 'profit', label: 'Profit' },
    { id: 'withdrawal', label: 'Withdrawals' },
    { id: 'profit_reversal', label: 'Refunds' },
    { id: 'commission_transfer_in', label: 'Transfers' },
]

const ROW_LIMIT = 10000

// Withdrawals use several in-flight statuses on the way to "completed".
function statusChip(status: string): { label: string; className: string } {
    if (status === 'completed') return { label: 'Done', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' }
    if (status === 'failed' || status === 'rejected') return { label: 'Failed', className: 'bg-red-500/15 text-red-600 dark:text-red-400' }
    if (status === 'reversed') return { label: 'Returned to wallet', className: 'bg-foreground/10 text-muted-foreground' }
    if (status === 'pending' || status.endsWith('_pending')) return { label: 'In progress', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500' }
    return { label: status.replace(/_/g, ' '), className: 'bg-foreground/10 text-muted-foreground' }
}

export default function ShopEarningsPage() {
    const { dbUser } = useAuth()
    const [wallet, setWallet] = useState<any>(null)
    const [rows, setRows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    const [capped, setCapped] = useState(false)
    const [typeFilter, setTypeFilter] = useState<Filter>('all')
    // A slow response for an earlier filter must never overwrite a newer one.
    const seq = useRef(0)

    const userId = dbUser?.id

    const fetchData = useCallback(async () => {
        if (!userId) return
        const mine = ++seq.current
        setLoading(true)
        setFailed(false)
        try {
            const { data: w, error: walletError } = await (supabase.from('shop_wallets') as any)
                .select('*').eq('owner_id', userId).maybeSingle()
            if (walletError) throw walletError
            if (mine !== seq.current) return
            setWallet(w)
            if (!w) { setRows([]); return }

            // Paged past the 1000-row request cap, stable order with id last.
            const { rows: loaded, truncated: capped, failed: readFailed } = await fetchAllRows(() => {
                let q = (supabase.from('shop_wallet_transactions') as any)
                    .select('*').eq('shop_wallet_id', w.id)
                if (typeFilter !== 'all') q = q.eq('type', typeFilter)
                return q.order('created_at', { ascending: false }).order('id', { ascending: false })
            }, ROW_LIMIT)
            if (readFailed && loaded.length === 0) throw new Error('Could not load wallet activity')
            if (mine !== seq.current) return
            setRows(loaded)
            setCapped(capped || readFailed)
        } catch (e) {
            if (mine !== seq.current) return
            console.error('Error loading shop earnings:', e)
            setFailed(true)
        } finally {
            if (mine === seq.current) setLoading(false)
        }
    }, [userId, typeFilter])

    useEffect(() => { fetchData() }, [fetchData])

    const paged = usePaged(rows, typeFilter)

    const exportCsv = () => {
        // Spreadsheet apps run cells that start with = + - @ as formulas, so those are defused.
        const esc = (v: unknown) => {
            const s = String(v ?? '')
            return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
        }
        const header = ['Date', 'Type', 'Amount', 'Status', 'Order']
        // shop_order_id is NULL on AFA profit rows (they key off afa_order_id instead).
        const lines = rows.map(r => [formatDate(r.created_at), r.type, r.amount, r.status, r.shop_order_id ?? r.afa_order_id ?? ''].map(esc).join(','))
        const csv = [header.map(esc).join(','), ...lines].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `shop-earnings-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
        URL.revokeObjectURL(url)
        toast.success('Earnings exported')
    }

    const tiles = [
        { label: 'In your wallet', value: wallet?.balance ?? 0, tone: 'text-foreground' },
        { label: 'Earned in total', value: wallet?.total_earned ?? 0, tone: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Withdrawn in total', value: wallet?.total_withdrawn ?? 0, tone: 'text-foreground' },
    ]

    return (
        <div className="space-y-5">
            <header className="neu-raised-sm flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                    <Link href="/dashboard/shop" className="mb-2 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <ArrowLeft className="h-3.5 w-3.5" /> My shop
                    </Link>
                    <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Wallet activity</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Every cedi that moved in or out of your shop wallet, newest first.</p>
                </div>
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={rows.length === 0}
                    className="clay-silver inline-flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold disabled:opacity-60"
                >
                    <Download className="h-4 w-4" /> Export CSV
                </button>
            </header>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {tiles.map(t => (
                    <div key={t.label} className="neu-raised-sm rounded-2xl p-4">
                        <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                        <p className={cn('mt-1 font-display text-2xl font-bold tabular-nums', t.tone)}>{formatCurrency(t.value)}</p>
                    </div>
                ))}
            </div>

            <section aria-label="Wallet history" className="neu-raised-sm rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold">History</h2>
                    <div role="group" aria-label="Filter by type" className="neu-inset flex max-w-full overflow-x-auto rounded-xl p-1">
                        {FILTERS.map(f => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setTypeFilter(f.id)}
                                aria-pressed={typeFilter === f.id}
                                className={cn(
                                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                                    typeFilter === f.id ? 'neu-raised-sm text-brand-700 dark:text-brand-500' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4" aria-busy={loading}>
                    {failed ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-red-500"><AlertCircle className="h-6 w-6" /></span>
                            <p className="text-sm font-medium">We couldn&apos;t load your wallet activity.</p>
                            <button type="button" onClick={fetchData} className="clay-gold inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold">
                                <RefreshCw className="h-4 w-4" /> Try again
                            </button>
                        </div>
                    ) : loading && rows.length === 0 ? (
                        <div className="space-y-3">
                            {[0, 1, 2, 3].map(i => <div key={i} className="neu-inset h-16 rounded-2xl" />)}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-center">
                            <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground"><Inbox className="h-5 w-5" /></span>
                            <p className="text-sm font-medium">Nothing here yet</p>
                            <p className="text-xs text-muted-foreground">Your profit and withdrawals will show up as they happen.</p>
                        </div>
                    ) : (
                        <>
                            <ul className={cn('divide-y divide-border transition-opacity', loading && 'opacity-60')}>
                                {paged.visible.map((r) => {
                                    const meta = TYPE_META[r.type] || { label: String(r.type).replace(/_/g, ' '), sign: '+' as const, tone: 'text-foreground', Icon: Wallet }
                                    const Icon = meta.Icon
                                    const chip = statusChip(String(r.status ?? ''))
                                    const returned = r.status === 'reversed'
                                    return (
                                        <li key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="neu-inset flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-brand-700 dark:text-brand-500">
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold">{meta.label}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-shrink-0 flex-col items-end gap-1">
                                                <p className={cn('text-sm font-semibold tabular-nums', returned ? 'text-muted-foreground line-through' : meta.tone)}>
                                                    {meta.sign}{formatCurrency(r.amount)}
                                                </p>
                                                {r.status && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', chip.className)}>{chip.label}</span>}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                            <Pager page={paged.page} pages={paged.pages} size={paged.size} total={paged.total} onPage={paged.setPage} onSize={paged.setSize} />
                            {capped && (
                                <p className="mt-3 text-center text-xs text-muted-foreground">Showing your latest {ROW_LIMIT.toLocaleString()} movements. Pick a type above to narrow it down.</p>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    )
}
