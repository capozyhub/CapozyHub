'use client'

import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, Crown, Minus, Repeat, Sparkles, Trophy, UserPlus, Users, Zap } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export interface InsightOrder {
    id: string
    guest_phone: string
    network?: string
    package_size?: string
    type_name?: string
    quantity?: number
    selling_price: number
    profit: number
    status: string
    created_at: string
    is_rc?: boolean
}

export type InsightWindow = 'all' | 'today' | '7d' | '30d'
type Metric = 'sales' | 'profit' | 'orders'

const EARNING = new Set(['pending', 'processing', 'completed'])
const METRICS: { key: Metric; label: string }[] = [
    { key: 'sales', label: 'Sales' },
    { key: 'profit', label: 'Profit' },
    { key: 'orders', label: 'Orders' },
]
const NETWORK_COLORS: Record<string, string> = {
    MTN: '#FFCC00', TELECEL: '#E60000', AT: '#0057B8', AIRTELTIGO: '#0057B8',
}

interface Bucket { key: string; label: string; sales: number; profit: number; orders: number }

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// "today" is shown hour by hour; every other window is shown day by day ("all" shows the last 30 days).
function buildBuckets(orders: InsightOrder[], window: InsightWindow): Bucket[] {
    const now = new Date()
    const buckets: Bucket[] = []
    const index = new Map<string, Bucket>()

    if (window === 'today') {
        for (let h = 0; h < 24; h++) {
            const b = { key: String(h), label: `${String(h).padStart(2, '0')}:00`, sales: 0, profit: 0, orders: 0 }
            buckets.push(b); index.set(b.key, b)
        }
    } else {
        const days = window === '7d' ? 7 : 30
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
            const b = { key: dayKey(d), label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), sales: 0, profit: 0, orders: 0 }
            buckets.push(b); index.set(b.key, b)
        }
    }

    for (const o of orders) {
        if (!EARNING.has(o.status)) continue
        const d = new Date(o.created_at)
        const b = index.get(window === 'today' ? String(d.getHours()) : dayKey(d))
        if (!b) continue
        b.sales += o.selling_price || 0
        b.profit += o.profit || 0
        b.orders += 1
    }
    return buckets
}

function productName(o: InsightOrder) {
    return o.is_rc ? (o.type_name || 'Results checker') : `${o.network ?? ''} ${o.package_size ?? ''}`.trim() || 'Other'
}

function growth(now: number, before: number): { pct: number | null; dir: 'up' | 'down' | 'flat' | 'new' | 'none' } {
    if (now === 0 && before === 0) return { pct: null, dir: 'none' }
    if (before === 0) return { pct: null, dir: 'new' }
    const pct = Math.round(((now - before) / before) * 100)
    return { pct, dir: pct === 0 ? 'flat' : pct > 0 ? 'up' : 'down' }
}

function GrowthChip({ g }: { g: ReturnType<typeof growth> }) {
    if (g.dir === 'none') return <span className="text-xs text-muted-foreground">No activity</span>
    if (g.dir === 'new') return <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:text-brand-500"><Sparkles className="h-3 w-3" /> New</span>
    const Icon = g.dir === 'flat' ? Minus : g.dir === 'up' ? ArrowUpRight : ArrowDownRight
    return (
        <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', g.dir === 'flat' ? 'bg-foreground/10 text-muted-foreground' : g.dir === 'up' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400')}>
            <Icon className="h-3.5 w-3.5" />{g.dir === 'flat' ? 'No change' : `${Math.abs(g.pct ?? 0)}%`}
        </span>
    )
}

const mask = (p: string) => (p.length > 6 ? `${p.slice(0, 3)}••••${p.slice(-3)}` : p)

export function ShopInsights({ orders, previous = [], window }: { orders: InsightOrder[]; previous?: InsightOrder[]; window: InsightWindow }) {
    const [metric, setMetric] = useState<Metric>('sales')
    const [picked, setPicked] = useState<number | null>(null)

    const data = useMemo(() => {
        const earning = orders.filter(o => EARNING.has(o.status))
        const prevEarning = previous.filter(o => EARNING.has(o.status))
        const sum = (list: InsightOrder[], k: 'selling_price' | 'profit') => list.reduce((s, o) => s + (o[k] || 0), 0)
        const sales = sum(earning, 'selling_price')
        const profit = sum(earning, 'profit')
        const prevBuyers = new Set(prevEarning.map(o => o.guest_phone))
        const spend = new Map<string, { orders: number; spent: number }>()
        for (const o of earning) {
            const s = spend.get(o.guest_phone) ?? { orders: 0, spent: 0 }
            s.orders += 1; s.spent += o.selling_price || 0
            spend.set(o.guest_phone, s)
        }
        const growthData = {
            sales: growth(sales, sum(prevEarning, 'selling_price')),
            profit: growth(profit, sum(prevEarning, 'profit')),
            orders: growth(earning.length, prevEarning.length),
            hasPrevious: previous.length > 0 || window === 'all',
        }
        const extra = {
            sales, profit, growth: growthData,
            margin: sales > 0 ? (profit / sales) * 100 : 0,
            newBuyers: [...spend.keys()].filter(p => !prevBuyers.has(p)).length,
            winBack: [...prevBuyers].filter(p => p && !spend.has(p)).length,
            topCustomers: [...spend.entries()].sort((a, b) => b[1].spent - a[1].spent).slice(0, 3),
        }
        const buckets = buildBuckets(orders, window)

        const products = new Map<string, { name: string; orders: number; profit: number }>()
        const networks = new Map<string, number>()
        const buyers = new Map<string, number>()
        for (const o of earning) {
            const name = productName(o)
            const p = products.get(name) ?? { name, orders: 0, profit: 0 }
            p.orders += o.is_rc ? (o.quantity || 1) : 1
            p.profit += o.profit || 0
            products.set(name, p)
            if (!o.is_rc && o.network) networks.set(o.network.toUpperCase(), (networks.get(o.network.toUpperCase()) ?? 0) + 1)
            if (o.guest_phone) buyers.set(o.guest_phone, (buyers.get(o.guest_phone) ?? 0) + 1)
        }

        const finished = orders.filter(o => o.status === 'completed' || o.status === 'failed')
        const delivered = finished.filter(o => o.status === 'completed').length
        const networkTotal = [...networks.values()].reduce((a, b) => a + b, 0)

        return {
            ...extra,
            profitByProduct: [...products.values()].sort((a, b) => b.profit - a.profit).slice(0, 4),
            buckets,
            bestSellers: [...products.values()].sort((a, b) => b.orders - a.orders || b.profit - a.profit).slice(0, 5),
            networks: [...networks.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ network: n, orders: c, share: networkTotal ? c / networkTotal : 0 })),
            customers: buyers.size,
            repeat: [...buyers.values()].filter(c => c > 1).length,
            avgProfit: earning.length ? earning.reduce((s, o) => s + (o.profit || 0), 0) / earning.length : 0,
            avgOrder: earning.length ? earning.reduce((s, o) => s + (o.selling_price || 0), 0) / earning.length : 0,
            deliveryRate: finished.length ? Math.round((delivered / finished.length) * 100) : null,
            earningCount: earning.length,
        }
    }, [orders, previous, window])

    const value = (b: Bucket) => (metric === 'sales' ? b.sales : metric === 'profit' ? b.profit : b.orders)
    const fmt = (n: number) => (metric === 'orders' ? `${n} ${n === 1 ? 'order' : 'orders'}` : formatCurrency(n))
    const max = Math.max(1, ...data.buckets.map(value))
    const total = data.buckets.reduce((s, b) => s + value(b), 0)
    const best = data.buckets.reduce<Bucket | null>((a, b) => (value(b) > (a ? value(a) : 0) ? b : a), null)
    const shown = picked !== null ? data.buckets[picked] : null

    const W = 600
    const H = 150
    const n = data.buckets.length
    const gap = n <= 7 ? 14 : n <= 24 ? 5 : 4
    const barW = (W - gap * (n - 1)) / n
    const rangeLabel = window === 'today' ? 'Today, hour by hour' : window === '7d' ? 'Last 7 days' : 'Last 30 days'

    return (
        <div className="grid gap-5 lg:grid-cols-12">
            <section aria-label="Sales chart" className="neu-raised-sm rounded-3xl p-5 sm:p-6 lg:col-span-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                            <BarChart3 className="h-4 w-4 text-brand-700 dark:text-brand-500" /> How your shop is doing
                        </h2>
                        <p className="text-xs text-muted-foreground">{rangeLabel}</p>
                    </div>
                    <div role="group" aria-label="Chart metric" className="neu-inset flex rounded-full p-1">
                        {METRICS.map(m => (
                            <button
                                key={m.key}
                                type="button"
                                aria-pressed={metric === m.key}
                                onClick={() => { setMetric(m.key); setPicked(null) }}
                                className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', metric === m.key ? 'clay-gold' : 'text-muted-foreground hover:text-foreground')}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {([['Sales', formatCurrency(data.sales), data.growth.sales], ['Profit', formatCurrency(data.profit), data.growth.profit], ['Sales made', String(data.earningCount), data.growth.orders]] as const).map(([label, v, g]) => (
                        <div key={label}>
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <p className="mt-1 font-display text-xl font-bold leading-none tracking-tight sm:text-2xl">{v}</p>
                            <div className="mt-2">{window === 'all' ? <span className="text-xs text-muted-foreground">All time</span> : <GrowthChip g={g} />}</div>
                        </div>
                    ))}
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Delivered</p>
                        <p className="mt-1 font-display text-xl font-bold leading-none tracking-tight sm:text-2xl">{data.deliveryRate === null ? '—' : `${data.deliveryRate}%`}</p>
                        <p className="mt-2 text-xs text-muted-foreground">of finished orders</p>
                    </div>
                </div>
                {window !== 'all' && <p className="mt-3 text-[11px] text-muted-foreground">Growth compares with the {window === 'today' ? 'day' : window === '7d' ? '7 days' : '30 days'} before.</p>}

                <div className="mt-6">
                    <div className="mb-2 flex h-5 items-center justify-between text-xs text-muted-foreground" aria-live="polite">
                        {shown ? (
                            <>
                                <span className="font-medium text-foreground">{shown.label}</span>
                                <span>{fmt(value(shown))}{metric !== 'orders' ? ` · ${shown.orders} ${shown.orders === 1 ? 'order' : 'orders'}` : ''}</span>
                            </>
                        ) : (
                            <span>Tap a bar to see that {window === 'today' ? 'hour' : 'day'}</span>
                        )}
                    </div>
                    <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" role="img" aria-label={`${METRICS.find(m => m.key === metric)?.label} for ${rangeLabel.toLowerCase()}`} preserveAspectRatio="none">
                        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="currentColor" strokeOpacity="0.15" />
                        {data.buckets.map((b, i) => {
                            const v = value(b)
                            const h = v === 0 ? 3 : Math.max(8, (v / max) * (H - 8))
                            return (
                                <g key={b.key}>
                                    <rect x={i * (barW + gap) - gap / 2} y={0} width={barW + gap} height={H} fill="transparent" className="cursor-pointer" onPointerEnter={() => setPicked(i)} onClick={() => setPicked(i)} />
                                    <rect
                                        x={i * (barW + gap)} y={H - h} width={barW} height={h}
                                        rx={Math.min(6, barW / 2)}
                                        className={cn('pointer-events-none', v === 0 ? 'fill-foreground/15' : picked === i ? 'fill-brand-600' : 'fill-brand-500')}
                                    />
                                </g>
                            )
                        })}
                    </svg>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>{data.buckets[0]?.label}</span>
                        <span>{window === 'today' ? 'Now' : 'Today'}</span>
                    </div>
                </div>

                <p className="neu-inset mt-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm leading-snug text-muted-foreground">
                    <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700 dark:text-brand-500" />
                    {data.earningCount === 0
                        ? 'No sales in this window yet. Share your shop link and your first one will show up here.'
                        : best && value(best) > 0
                            ? `Your best ${window === 'today' ? 'hour' : 'day'} was ${best.label} with ${fmt(value(best))}. Average sale is ${formatCurrency(data.avgOrder)}.`
                            : `Average sale is ${formatCurrency(data.avgOrder)}.`}
                </p>
            </section>

            <div className="space-y-5 lg:col-span-4">
                <section aria-label="Customers" className="neu-raised-sm rounded-3xl p-5">
                    <h2 className="font-display text-base font-semibold">Your customers</h2>
                    <div className="mt-3 grid grid-cols-3 gap-2.5">
                        {([[Users, data.customers, 'Buyers'], [Repeat, data.repeat, 'Came back'], [UserPlus, window === 'all' ? data.customers : data.newBuyers, 'New']] as const).map(([Icon, n, label]) => (
                            <div key={label} className="neu-inset rounded-2xl p-3">
                                <Icon className="h-4 w-4 text-brand-700 dark:text-brand-500" />
                                <p className="mt-2 font-display text-2xl font-bold leading-none">{n}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>
                    {data.customers > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">{Math.round((data.repeat / data.customers) * 100)}% of buyers ordered more than once.</p>
                    )}
                    {data.topCustomers.length > 0 && (
                        <ul className="mt-3 space-y-2 border-t border-border pt-3">
                            {data.topCustomers.map(([phone, s]) => (
                                <li key={phone} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="font-mono text-xs text-muted-foreground">{mask(phone)}</span>
                                    <span className="tabular-nums"><span className="font-semibold">{formatCurrency(s.spent)}</span> <span className="text-xs text-muted-foreground">· {s.orders}×</span></span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {window !== 'all' && data.winBack > 0 && (
                        <p className="neu-inset mt-3 rounded-xl px-3 py-2 text-xs leading-snug text-muted-foreground">
                            {data.winBack} {data.winBack === 1 ? 'customer' : 'customers'} from before haven&apos;t bought this time. A quick SMS can win them back.
                        </p>
                    )}
                </section>

                <section aria-label="Profit engine" className="neu-raised-sm rounded-3xl p-5">
                    <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Zap className="h-4 w-4 text-brand-700 dark:text-brand-500" /> Profit engine</h2>
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                        <div className="neu-inset rounded-2xl p-3">
                            <p className="font-display text-2xl font-bold leading-none">{data.margin.toFixed(1)}%</p>
                            <p className="mt-1 text-xs text-muted-foreground">Margin on sales</p>
                        </div>
                        <div className="neu-inset rounded-2xl p-3">
                            <p className="font-display text-2xl font-bold leading-none">{formatCurrency(data.avgProfit)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Profit per sale</p>
                        </div>
                    </div>
                    {data.profitByProduct.length > 0 && (
                        <ul className="mt-3 space-y-2.5">
                            {data.profitByProduct.map(p => (
                                <li key={p.name}>
                                    <div className="flex items-baseline justify-between text-sm">
                                        <span className="truncate font-medium">{p.name}</span>
                                        <span className="tabular-nums text-emerald-600 dark:text-emerald-400">+{formatCurrency(p.profit)}</span>
                                    </div>
                                    <div className="neu-inset mt-1 h-1.5 overflow-hidden rounded-full">
                                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (p.profit / Math.max(0.01, data.profitByProduct[0].profit)) * 100)}%` }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {data.earningCount > 0 && data.margin < 5 && (
                        <p className="neu-inset mt-3 rounded-xl px-3 py-2 text-xs leading-snug text-muted-foreground">Your margin is thin. Raising prices a little on your best sellers adds profit without losing sales.</p>
                    )}
                </section>

                <section aria-label="Best sellers" className="neu-raised-sm rounded-3xl p-5">
                    <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Trophy className="h-4 w-4 text-brand-700 dark:text-brand-500" /> Best sellers</h2>
                    {data.bestSellers.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">Nothing sold in this window yet.</p>
                    ) : (
                        <ol className="mt-3 space-y-2.5">
                            {data.bestSellers.map((p, i) => (
                                <li key={p.name} className="flex items-center justify-between gap-3 text-sm">
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <span className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold', i === 0 ? 'clay-gold' : 'neu-inset text-muted-foreground')}>
                                            {i === 0 ? <Crown className="h-3 w-3" /> : i + 1}
                                        </span>
                                        <span className="truncate font-medium">{p.name}</span>
                                    </span>
                                    <span className="flex-shrink-0 text-right tabular-nums">
                                        <span className="font-semibold">{p.orders}</span>
                                        <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">+{formatCurrency(p.profit)}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                {data.networks.length > 0 && (
                    <section aria-label="By network" className="neu-raised-sm rounded-3xl p-5">
                        <h2 className="font-display text-base font-semibold">By network</h2>
                        <ul className="mt-3 space-y-3">
                            {data.networks.map(nw => (
                                <li key={nw.network}>
                                    <div className="flex items-baseline justify-between text-sm">
                                        <span className="font-medium">{nw.network === 'AT' || nw.network === 'AIRTELTIGO' ? 'AirtelTigo' : nw.network === 'MTN' ? 'MTN' : nw.network.charAt(0) + nw.network.slice(1).toLowerCase()}</span>
                                        <span className="tabular-nums text-muted-foreground">{nw.orders} · {Math.round(nw.share * 100)}%</span>
                                    </div>
                                    <div className="neu-inset mt-1.5 h-2 overflow-hidden rounded-full">
                                        <div className="h-full rounded-full" style={{ width: `${Math.max(4, nw.share * 100)}%`, backgroundColor: NETWORK_COLORS[nw.network] ?? '#8E8E8E' }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    )
}
