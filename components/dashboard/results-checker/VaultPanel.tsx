'use client'

import { useMemo, useState } from 'react'
import { Loader2, RefreshCw, Search, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { RCOrder } from './meta'
import { VaultItem } from './VaultItem'
import { ComplaintDialog } from './ComplaintDialog'

type Period = 'all' | 'today' | 'week' | 'month'

const PERIODS: { key: Period; label: string }[] = [
    { key: 'all', label: 'All time' },
    { key: 'month', label: 'This month' },
    { key: 'week', label: 'This week' },
    { key: 'today', label: 'Today' },
]

const HISTORY_LIMIT = 50

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

interface VaultPanelProps {
    orders: RCOrder[]
    loading: boolean
    ownPhone?: string
    ownEmail?: string
    onRefresh: () => void
    onComplaintFiled: (orderId: string) => void
    onBuy: () => void
}

export function VaultPanel({ orders, loading, ownPhone, ownEmail, onRefresh, onComplaintFiled, onBuy }: VaultPanelProps) {
    const [search, setSearch] = useState('')
    const [period, setPeriod] = useState<Period>('all')
    const [reporting, setReporting] = useState<RCOrder | null>(null)

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        return orders.filter(o => (!q || o.reference_code.toLowerCase().includes(q) || o.type_name.toLowerCase().includes(q)) && inPeriod(new Date(o.created_at), period))
    }, [orders, search, period])

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label="Search your vouchers" placeholder="Search by exam or order number" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 text-sm" />
                </div>
                <div role="group" aria-label="Time" className="well flex gap-1 overflow-x-auto rounded-2xl p-1">
                    {PERIODS.map(p => (
                        <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)} className={cn('whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', period === p.key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}>{p.label}</button>
                    ))}
                </div>
                <Button variant="outline" size="icon" aria-label="Refresh" onClick={onRefresh} disabled={loading}><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></Button>
            </div>

            {loading && orders.length === 0 ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : orders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <Ticket className="h-10 w-10 text-muted-foreground opacity-40" />
                    <p className="font-display text-lg font-semibold">No vouchers yet</p>
                    <p className="max-w-xs text-sm text-muted-foreground">Everything you buy is saved here, so you can find your serial and PIN again any time.</p>
                    <Button onClick={onBuy}>Get a results checker</Button>
                </div>
            ) : visible.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches that. Try another search or time.</p>
            ) : (
                <>
                    <ul className="max-w-4xl space-y-3">
                        {visible.map(o => <VaultItem key={o.id} order={o} ownPhone={ownPhone} ownEmail={ownEmail} onReport={setReporting} />)}
                    </ul>
                    {orders.length >= HISTORY_LIMIT && <p className="pb-16 text-center text-xs text-muted-foreground">Showing your latest {HISTORY_LIMIT} orders.</p>}
                </>
            )}

            <ComplaintDialog order={reporting} onClose={() => setReporting(null)} onFiled={onComplaintFiled} />
        </div>
    )
}