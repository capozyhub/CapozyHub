'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Download, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { STATUS, downloadAfaReceipt, formatDob, maskGhanaCardDisplay, type AfaOrder } from './meta'

type Period = 'all' | 'today' | 'week' | 'month'
const PERIODS: { key: Period; label: string }[] = [
    { key: 'all', label: 'All time' },
    { key: 'month', label: 'This month' },
    { key: 'week', label: 'This week' },
    { key: 'today', label: 'Today' },
]

function inPeriod(created: Date, period: Period): boolean {
    const now = new Date()
    const day = new Date(created); day.setHours(0, 0, 0, 0)
    const today = new Date(now); today.setHours(0, 0, 0, 0)
    switch (period) {
        case 'today': return day.getTime() === today.getTime()
        case 'week': { const w = new Date(today); w.setDate(w.getDate() - w.getDay()); return day >= w }
        case 'month': return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
        default: return true
    }
}

interface OrdersPanelProps {
    orders: AfaOrder[]
    loading: boolean
    onRefresh: () => void
    onRegister: () => void
}

/** Past registrations as an expandable list — mirrors the results-checker vault. */
export function OrdersPanel({ orders, loading, onRefresh, onRegister }: OrdersPanelProps) {
    const [search, setSearch] = useState('')
    const [period, setPeriod] = useState<Period>('all')
    const [openId, setOpenId] = useState<string | null>(null)

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        return orders.filter(o =>
            (!q || o.full_name.toLowerCase().includes(q) || o.phone.includes(q)) &&
            inPeriod(new Date(o.created_at), period)
        )
    }, [orders, search, period])

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label="Search your registrations" placeholder="Search by name or phone" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 text-sm" />
                </div>
                <div role="group" aria-label="Time" className="well flex gap-1 overflow-x-auto rounded-2xl p-1">
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
                <Button variant="outline" size="icon" aria-label="Refresh" onClick={onRefresh} disabled={loading}>
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
            </div>

            {loading && orders.length === 0 ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : orders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <ShieldCheck className="h-10 w-10 text-muted-foreground opacity-40" />
                    <p className="font-display text-lg font-semibold">No registrations yet</p>
                    <p className="max-w-xs text-sm text-muted-foreground">Register yourself or anyone else, and it will show up here.</p>
                    <Button onClick={onRegister}>Register someone</Button>
                </div>
            ) : visible.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches that. Try another search or time.</p>
            ) : (
                <ul className="max-w-4xl space-y-3">
                    {visible.map(o => {
                        const cfg = STATUS[o.status] ?? STATUS.pending
                        const isOpen = openId === o.id
                        return (
                            <li key={o.id} className="surface overflow-hidden rounded-2xl">
                                <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    onClick={() => setOpenId(isOpen ? null : o.id)}
                                    className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">{o.full_name}</span>
                                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                                        </span>
                                        <span className="mt-0.5 block text-xs text-muted-foreground">{o.phone} · {o.location}, {o.region}</span>
                                    </span>
                                    <span className="flex-shrink-0 font-display text-sm font-bold tabular-nums">
                                        {o.payment_amount != null ? formatCurrency(o.payment_amount) : '—'}
                                    </span>
                                    <ChevronDown className={cn('h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} aria-hidden />
                                </button>

                                {isOpen && (
                                    <div className="space-y-3 border-t border-border/60 p-4">
                                        <p className="text-sm text-muted-foreground">{cfg.blurb}</p>
                                        <dl className="well grid grid-cols-1 gap-2 rounded-2xl p-4 text-sm sm:grid-cols-2">
                                            {([
                                                ['Ghana Card', maskGhanaCardDisplay(o.id_number ?? o.ghana_card)],
                                                ...(o.date_of_birth ? [['Date of birth', formatDob(o.date_of_birth)]] : []),
                                                ['Submitted', new Date(o.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })],
                                                ...(o.notes ? [['Notes', o.notes]] : []),
                                            ] as [string, string][]).map(([label, value]) => (
                                                <div key={label} className="flex items-center justify-between gap-3">
                                                    <dt className="text-muted-foreground">{label}</dt>
                                                    <dd className="font-medium text-right">{value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                        <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadAfaReceipt(o)}>
                                            <Download className="h-4 w-4" /> Download receipt
                                        </Button>
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
