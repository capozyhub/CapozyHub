'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, Loader2, RefreshCw, Search } from 'lucide-react'
import { endOfDay, isSameDay, isWithinInterval, parseISO, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { AirtimeOrder } from './meta'
import { OrderCard } from './OrderCard'

type Period = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'
type TypeFilter = 'all' | 'airtime' | 'mashup'

const PERIODS: { key: Period; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Custom' },
]

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

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
    return (
        <div role="group" aria-label={label} className="well flex gap-1 overflow-x-auto rounded-2xl p-1">
            {options.map(o => (
                <button
                    key={o.key}
                    type="button"
                    aria-pressed={value === o.key}
                    onClick={() => onChange(o.key)}
                    className={cn('whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', value === o.key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}

/** The member's airtime and Mashup orders, with search, type and date filters. */
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
            toast.error('Could not load your orders')
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
        spent: visible.reduce((sum, o) => sum + (o.status === 'completed' ? Number(o.total_paid) : 0), 0),
        pending: visible.filter(o => o.status === 'pending' || o.status === 'processing').length,
    }), [visible])

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
                {[
                    ['Orders', String(visible.length)],
                    ['Pending', String(stats.pending)],
                    ['Completed spend', formatCurrency(stats.spent)],
                ].map(([label, value]) => (
                    <div key={label} className="neu-raised-sm min-w-0 rounded-2xl px-3 py-2.5">
                        <p className="truncate text-xs text-muted-foreground">{label}</p>
                        <p className="truncate font-display text-base font-bold tabular-nums">{value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label="Search orders" placeholder="Number or reference" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 text-sm" />
                </div>
                <Chips<TypeFilter> label="Product" value={type} onChange={setType} options={[{ key: 'all', label: 'All' }, { key: 'airtime', label: 'Airtime' }, { key: 'mashup', label: 'Mashup' }]} />
                <Button variant="outline" size="icon" aria-label="Refresh orders" onClick={load} disabled={loading}>
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
            </div>

            <Chips<Period> label="Date" value={period} onChange={setPeriod} options={PERIODS} />
            {period === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2"><span className="text-muted-foreground">From</span><Input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="h-10 w-auto" /></label>
                    <label className="flex items-center gap-2"><span className="text-muted-foreground">To</span><Input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="h-10 w-auto" /></label>
                </div>
            )}

            {loading && orders.length === 0 ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : visible.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                    <History className="h-10 w-10 opacity-30" />
                    <p className="text-sm">{orders.length === 0 ? 'You have not bought any airtime yet' : 'No orders match these filters'}</p>
                </div>
            ) : (
                <ul className="grid gap-3 pb-16 lg:grid-cols-2">
                    {visible.map(o => <OrderCard key={o.id} order={o} />)}
                </ul>
            )}
        </div>
    )
}
