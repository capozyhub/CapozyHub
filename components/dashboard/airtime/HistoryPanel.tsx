'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Receipt, RefreshCw, Search } from 'lucide-react'
import { endOfDay, format, isSameDay, isToday, isWithinInterval, isYesterday, parseISO, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { AirtimeOrder } from './meta'
import { OrderCard } from './OrderCard'

type Period = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
type TypeFilter = 'all' | 'airtime' | 'mashup'

const PERIODS: { key: Period; label: string }[] = [
    { key: 'all', label: 'Any time' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Pick dates' },
]

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-500'

function inPeriod(date: Date, period: Period, from: string, to: string): boolean {
    const now = new Date()
    switch (period) {
        case 'today': return isSameDay(date, now)
        case 'yesterday': return isSameDay(date, subDays(now, 1))
        case 'week': return isWithinInterval(date, { start: startOfWeek(now), end: endOfDay(now) })
        case 'month': return isWithinInterval(date, { start: startOfMonth(now), end: endOfDay(now) })
        case 'custom':
            if (!from || !to) return true
            return isWithinInterval(date, { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) })
        default: return true
    }
}

function dayLabel(date: Date): string {
    if (isToday(date)) return 'Today'
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'EEEE, d MMMM')
}

function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
    return (
        <div role="group" aria-label={label} className="neu-inset flex gap-1 overflow-x-auto rounded-full p-1">
            {options.map(o => (
                <button
                    key={o.key}
                    type="button"
                    aria-pressed={value === o.key}
                    onClick={() => onChange(o.key)}
                    className={cn('whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors', FOCUS, value === o.key ? 'clay-black' : 'text-muted-foreground hover:text-foreground')}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}

/** Receipts: a ledger of the member's airtime and Mashup orders, grouped by day. */
export function HistoryPanel({ reloadKey }: { reloadKey: number }) {
    const [orders, setOrders] = useState<AirtimeOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [period, setPeriod] = useState<Period>('all')
    const [type, setType] = useState<TypeFilter>('all')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/airtime/history?limit=100', { cache: 'no-store' })
            if (!res.ok) throw new Error()
            const json = await res.json()
            setOrders(json.orders ?? [])
        } catch {
            toast.error('We could not load your receipts.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load, reloadKey])

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        return orders.filter(o => {
            if (type !== 'all' && (o.type ?? 'airtime') !== type) return false
            if (q && !o.beneficiary_phone.toLowerCase().includes(q) && !o.reference_code.toLowerCase().includes(q)) return false
            return inPeriod(parseISO(o.created_at), period, from, to)
        })
    }, [orders, search, type, period, from, to])

    const stats = useMemo(() => ({
        delivered: visible.filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total_paid), 0),
        waiting: visible.filter(o => o.status === 'pending' || o.status === 'processing').length,
    }), [visible])

    const days = useMemo(() => {
        const groups: { key: string; date: Date; items: AirtimeOrder[] }[] = []
        for (const o of visible) {
            const date = parseISO(o.created_at)
            const key = format(date, 'yyyy-MM-dd')
            const last = groups[groups.length - 1]
            if (last && last.key === key) last.items.push(o)
            else groups.push({ key, date, items: [o] })
        }
        return groups
    }, [visible])

    return (
        <div className="space-y-6">
            {/* The numbers that matter, on the black stage */}
            <div className="neu-night grid grid-cols-3 divide-x divide-white/10 rounded-[2rem] py-5 text-white">
                {[
                    ['Receipts', String(visible.length)],
                    ['Waiting', String(stats.waiting)],
                    ['Delivered', formatCurrency(stats.delivered)],
                ].map(([label, value]) => (
                    <div key={label} className="min-w-0 px-4 text-center sm:px-8">
                        <p className="truncate font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
                        <p className="mt-0.5 truncate text-xs text-silver-200">{label}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="neu-inset relative min-w-0 flex-1 rounded-full sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search receipts"
                        placeholder="Find a number or reference"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-11 rounded-full border-0 bg-transparent pl-11 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-0 dark:focus-visible:ring-brand-500"
                    />
                </div>
                <Pills<TypeFilter> label="Product" value={type} onChange={setType} options={[{ key: 'all', label: 'Everything' }, { key: 'airtime', label: 'Airtime' }, { key: 'mashup', label: 'Mashup' }]} />
                <button
                    type="button"
                    aria-label="Refresh receipts"
                    onClick={load}
                    disabled={loading}
                    className={cn('neu-raised-sm neu-press flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-60', FOCUS)}
                >
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </button>
            </div>

            <Pills<Period> label="When" value={period} onChange={setPeriod} options={PERIODS} />
            {period === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="neu-inset flex items-center gap-2 rounded-full py-1 pl-4 pr-2"><span className="text-muted-foreground">From</span><Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="h-9 w-auto border-0 bg-transparent shadow-none" /></label>
                    <label className="neu-inset flex items-center gap-2 rounded-full py-1 pl-4 pr-2"><span className="text-muted-foreground">To</span><Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="h-9 w-auto border-0 bg-transparent shadow-none" /></label>
                </div>
            )}

            {loading && orders.length === 0 ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : visible.length === 0 ? (
                <div className="neu-raised flex flex-col items-center gap-3 rounded-[2rem] px-6 py-16 text-center">
                    <span className="neu-inset flex h-14 w-14 items-center justify-center rounded-full"><Receipt className="h-6 w-6 text-muted-foreground" /></span>
                    <p className="font-display text-lg font-bold">{orders.length === 0 ? 'No receipts yet.' : 'Nothing matches that.'}</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                        {orders.length === 0 ? 'Your first top-up will show up here the moment you place it.' : 'Try a different date or clear the search.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6 pb-16">
                    {days.map(day => (
                        <section key={day.key} aria-label={dayLabel(day.date)}>
                            <h3 className="mb-2.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dayLabel(day.date)}</h3>
                            <ul className="neu-raised divide-y divide-border/70 overflow-hidden rounded-[1.75rem]">
                                {day.items.map(o => <OrderCard key={o.id} order={o} />)}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}
