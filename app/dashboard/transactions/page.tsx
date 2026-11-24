'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Download, Loader2, Receipt, Search } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { WalletStatsCard } from '@/components/dashboard/WalletStatsCard'
import { Notice } from '@/components/auth/fields'
import { FOCUS } from '@/components/auth/auth-shell'

const ITEMS_PER_PAGE = 20

const TYPE_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'credit', label: 'Money in' },
    { id: 'debit', label: 'Money out' },
]

const SOURCE_FILTERS = [
    { id: 'all', label: 'Everything' },
    { id: 'purchase', label: 'Data purchases' },
    { id: 'airtime', label: 'Airtime' },
    { id: 'payment', label: 'Wallet top-ups' },
    { id: 'admin', label: 'Adjustments' },
    { id: 'refund', label: 'Refunds' },
]

// A spreadsheet treats a cell starting with = + - @ as a formula, so defuse those in the export.
const csvCell = (v: unknown) => {
    const s = String(v ?? '')
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
}

export default function TransactionsPage() {
    const { dbUser } = useAuth()
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [sourceFilter, setSourceFilter] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [stats, setStats] = useState({
        todayIn: 0, todayOut: 0, todayRefunds: 0,
        wallet: null as { balance: number; total_credited: number; total_spent: number } | null,
    })
    // Only the newest request may update the screen, so fast filter changes never show old rows.
    const seq = useRef(0)

    const load = useCallback(async () => {
        if (!dbUser?.id) return
        const mine = ++seq.current
        const userId = dbUser.id as any
        setLoading(true)
        setFailed(false)
        try {
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)

            let countQuery = (supabase.from('wallet_transactions') as any).select('*', { count: 'exact', head: true }).eq('user_id', userId)
            if (typeFilter !== 'all') countQuery = countQuery.eq('type', typeFilter)
            if (sourceFilter !== 'all') countQuery = countQuery.eq('source', sourceFilter)
            if (startDate) countQuery = countQuery.gte('created_at', startDate)
            if (endDate) countQuery = countQuery.lte('created_at', `${endDate}T23:59:59`)

            const [pageRes, countRes, todayRes, walletRes] = await Promise.all([
                (supabase as any).rpc('get_user_transactions_with_balance', {
                    p_user_id: userId,
                    p_limit: ITEMS_PER_PAGE,
                    p_offset: page * ITEMS_PER_PAGE,
                    p_source_filter: sourceFilter,
                    p_type_filter: typeFilter,
                    p_start_date: startDate || null,
                    p_end_date: endDate ? `${endDate}T23:59:59` : null,
                }),
                countQuery,
                // Today's rows can exceed 1000 for a busy reseller, so read them all.
                fetchAllRows(() => (supabase.from('wallet_transactions') as any)
                    .select('type, source, amount')
                    .eq('user_id', userId).eq('status', 'completed')
                    .gte('created_at', todayStart.toISOString())
                    .order('created_at', { ascending: false }).order('id', { ascending: false })),
                (supabase.from('wallets') as any).select('balance, total_credited, total_spent').eq('user_id', userId).single(),
            ])
            if (mine !== seq.current) return
            if ((pageRes as any).error) throw (pageRes as any).error

            const today = todayRes.rows
            if (todayRes.failed || (walletRes as any).error) setFailed(true)
            const sum = (rows: any[]) => rows.reduce((s, t) => s + (t.amount || 0), 0)
            setTransactions((pageRes as any).data || [])
            setTotalCount((countRes as any).count || 0)
            setStats({
                todayIn: sum(today.filter(t => t.type === 'credit')),
                todayOut: sum(today.filter(t => t.type === 'debit' && t.source !== 'refund')),
                todayRefunds: sum(today.filter(t => t.source === 'refund')),
                wallet: (walletRes as any).data || null,
            })
        } catch (e) {
            if (mine !== seq.current) return
            console.error('Error fetching transactions:', e)
            setFailed(true)
        } finally {
            if (mine === seq.current) setLoading(false)
        }
    }, [dbUser?.id, page, typeFilter, sourceFilter, startDate, endDate])

    useEffect(() => { load() }, [load])

    const q = searchQuery.trim().toLowerCase()
    const visible = q
        ? transactions.filter(t => t.description?.toLowerCase().includes(q) || t.reference?.toLowerCase().includes(q))
        : transactions

    const resetFilters = () => {
        setStartDate(''); setEndDate(''); setTypeFilter('all'); setSourceFilter('all'); setSearchQuery(''); setPage(0)
    }

    const exportCsv = () => {
        const header = ['Date', 'Type', 'Source', 'Description', 'Amount', 'Balance after', 'Status']
        const lines = visible.map((t: any) => [
            formatDate(t.created_at), t.type, t.source, t.description, t.amount,
            t.balance_after !== undefined ? t.balance_after : '', t.status,
        ].map(csvCell).join(','))
        const csv = [header.map(csvCell).join(','), ...lines].join('\n')
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
        const a = document.createElement('a')
        a.href = url; a.download = `wallet-activity-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    const firstLoad = loading && transactions.length === 0 && !failed
    const tiles = [
        { label: 'In today', value: formatCurrency(stats.todayIn) },
        { label: 'Out today', value: formatCurrency(stats.todayOut) },
        { label: 'Refunded today', value: formatCurrency(stats.todayRefunds) },
    ]
    const selectClass = cn('neu-inset h-11 rounded-xl bg-transparent px-3 text-sm text-foreground', FOCUS)

    return (
        <div className="space-y-5">
            <header className="flex items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Wallet activity</h1>
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={visible.length === 0}
                    className={cn('neu-raised-sm neu-press flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50', FOCUS)}
                >
                    <Download className="h-4 w-4" aria-hidden="true" /> Export this page
                </button>
            </header>

            {failed && (
                <Notice>
                    We could not load your activity.{' '}
                    <button type="button" onClick={load} className={cn('rounded font-semibold underline underline-offset-2', FOCUS)}>Try again</button>
                </Notice>
            )}

            {stats.wallet && (
                <WalletStatsCard
                    balance={stats.wallet.balance || 0}
                    totalCredited={stats.wallet.total_credited || 0}
                    totalSpent={stats.wallet.total_spent || 0}
                />
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {tiles.map(t => (
                    <div key={t.label} className="neu-raised-sm rounded-2xl p-4">
                        <p className="text-sm text-muted-foreground">{t.label}</p>
                        <p className="mt-1 font-display text-2xl font-bold tabular-nums">{t.value}</p>
                    </div>
                ))}
            </div>

            <section className="neu-raised-sm space-y-4 rounded-3xl p-5 sm:p-6" aria-label="Filters">
                <div className="neu-inset flex items-center gap-2 rounded-xl px-3 focus-within:outline focus-within:outline-2 focus-within:outline-black dark:focus-within:outline-brand-500">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <input
                        aria-label="Search the rows on this page"
                        placeholder="Search this page by description or reference"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-11 w-full bg-transparent text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none"
                    />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="space-y-1 text-sm font-semibold">
                        Type
                        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }} className={cn(selectClass, 'block')}>
                            {TYPE_FILTERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm font-semibold">
                        Category
                        <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(0) }} className={cn(selectClass, 'block')}>
                            {SOURCE_FILTERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm font-semibold">
                        From
                        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0) }} className={cn(selectClass, 'block')} />
                    </label>
                    <label className="space-y-1 text-sm font-semibold">
                        To
                        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0) }} className={cn(selectClass, 'block')} />
                    </label>
                    <button type="button" onClick={resetFilters} className={cn('min-h-11 rounded px-2 text-sm font-semibold text-brand-800 underline underline-offset-2 dark:text-brand-400', FOCUS)}>
                        Clear filters
                    </button>
                </div>
            </section>

            <section className="neu-raised-sm rounded-3xl p-3 sm:p-4" aria-label="Transactions" aria-busy={loading}>
                {firstLoad ? (
                    <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your activity
                    </p>
                ) : visible.length === 0 ? (
                    <div className="py-12 text-center">
                        <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
                        <p className="font-semibold">{failed ? 'Nothing to show' : 'No activity matches'}</p>
                        {!failed && <p className="mt-1 text-sm text-muted-foreground">Try a different filter or date range.</p>}
                    </div>
                ) : (
                    <ul className={cn('space-y-2', loading && 'opacity-60')}>
                        {visible.map(txn => {
                            const credit = txn.type === 'credit'
                            return (
                                <li key={txn.id} className="neu-inset flex items-center gap-3 rounded-2xl p-3">
                                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', credit ? 'clay-gold' : 'clay-black')} aria-hidden="true">
                                        {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{txn.description}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {formatDate(txn.created_at)}
                                            {txn.reference ? ` · ref ${String(txn.reference).slice(-6).toUpperCase()}` : ''}
                                            {txn.status && txn.status !== 'completed' ? ` · ${txn.status}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn('font-display text-base font-bold tabular-nums', 'text-foreground')}>
                                            {credit ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </p>
                                        {txn.balance_after !== undefined && (
                                            <p className="text-xs tabular-nums text-muted-foreground">Balance {formatCurrency(txn.balance_after)}</p>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}

                {totalCount > ITEMS_PER_PAGE && (
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border px-1 pt-3">
                        <p className="text-sm text-muted-foreground">
                            {page * ITEMS_PER_PAGE + 1} to {Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                        </p>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}
                                className={cn('neu-raised-sm neu-press min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50', FOCUS)}>
                                Previous
                            </button>
                            <button type="button" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * ITEMS_PER_PAGE >= totalCount || loading}
                                className={cn('neu-raised-sm neu-press min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50', FOCUS)}>
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}
