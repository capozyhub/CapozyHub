'use client'

import { useMemo, useState } from 'react'
import { Clock, Loader2, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { RCOrder } from './meta'
import { OrderRow } from './OrderRow'
import { ComplaintDialog } from './ComplaintDialog'

type Period = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'

const PERIODS: { key: Period; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Custom' },
]

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

function inPeriod(created: Date, period: Period, from: string, to: string): boolean {
    const today = startOfDay(new Date())
    const day = startOfDay(created)
    switch (period) {
        case 'today': return day.getTime() === today.getTime()
        case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return day.getTime() === y.getTime() }
        case 'week': { const w = new Date(today); w.setDate(w.getDate() - w.getDay()); return day >= w }
        case 'month': return created.getMonth() === today.getMonth() && created.getFullYear() === today.getFullYear()
        case 'custom':
            if (from && day < startOfDay(new Date(from))) return false
            if (to && day > startOfDay(new Date(to))) return false
            return true
        default: return true
    }
}

interface HistoryPanelProps {
    orders: RCOrder[]
    loading: boolean
    ownPhone?: string
    ownEmail?: string
    onRefresh: () => void
    onComplaintFiled: (orderId: string) => void
}

export function HistoryPanel({ orders, loading, ownPhone, ownEmail, onRefresh, onComplaintFiled }: HistoryPanelProps) {
    const [search, setSearch] = useState('')
    const [period, setPeriod] = useState<Period>('all')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [reporting, setReporting] = useState<RCOrder | null>(null)

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        return orders.filter(o =>
            (!q || o.reference_code.toLowerCase().includes(q) || o.type_name.toLowerCase().includes(q))
            && inPeriod(new Date(o.created_at), period, from, to))
    }, [orders, search, period, from, to])

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label="Search orders" placeholder="Reference or exam" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 text-sm" />
                </div>
                <Button variant="outline" size="icon" aria-label="Refresh orders" onClick={onRefresh} disabled={loading}>
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
            </div>

            <div role="group" aria-label="Date" className="well flex gap-1 overflow-x-auto rounded-2xl p-1">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        type="button"
                        aria-pressed={period === p.key}
                        onClick={() => setPeriod(p.key)}
                        className={cn('whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', period === p.key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
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
                    <Clock className="h-10 w-10 opacity-30" />
                    <p className="text-sm">{orders.length === 0 ? 'You have not bought any vouchers yet' : 'No orders match these filters'}</p>
                </div>
            ) : (
                <ul className="space-y-3 pb-16">
                    {visible.map(o => <OrderRow key={o.id} order={o} ownPhone={ownPhone} ownEmail={ownEmail} onReport={setReporting} />)}
                </ul>
            )}

            <ComplaintDialog order={reporting} onClose={() => setReporting(null)} onFiled={onComplaintFiled} />
        </div>
    )
}