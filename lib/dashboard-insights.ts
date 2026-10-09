// Turns a member's recent orders into the numbers the dashboard home shows: spend and order
// growth against the previous period, a daily series for the chart, status and network mix.
// Pure functions, no I/O, so the maths can be checked on its own.

export interface InsightOrder {
    created_at: string | null
    status: string | null
    price: number | null
    network: string | null
}

export interface InsightAfa {
    created_at: string | null
    status: string | null
    payment_amount: number | null
}

export interface DayPoint {
    /** Local calendar day, YYYY-MM-DD. */
    key: string
    label: string
    orders: number
    spend: number
}

export interface PeriodTotals {
    orders: number
    spend: number
    completed: number
    inProgress: number
    failed: number
}

export interface Growth {
    /** Percent change, rounded. null when there is nothing to compare against. */
    pct: number | null
    direction: 'up' | 'down' | 'flat' | 'new' | 'none'
}

export interface NetworkShare {
    network: string
    orders: number
    share: number
}

export interface DashboardInsights {
    days: number
    series: DayPoint[]
    current: PeriodTotals
    previous: PeriodTotals
    spendGrowth: Growth
    orderGrowth: Growth
    /** completed / (completed + failed), as a percentage. null with no finished orders. */
    successRate: number | null
    networks: NetworkShare[]
    bestDay: DayPoint | null
    today: { orders: number; spend: number }
}

// Orders that took money. Refunded and failed orders were paid back, so they do not count as spend.
const COUNTS_AS_SPEND = new Set(['completed', 'pending', 'processing', 'queued'])
const IN_PROGRESS = new Set(['pending', 'processing', 'queued'])
const FAILED = new Set(['failed', 'refunded'])

const DAY_MS = 86_400_000

export function dayKey(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
}

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function emptyTotals(): PeriodTotals {
    return { orders: 0, spend: 0, completed: 0, inProgress: 0, failed: 0 }
}

export function computeGrowth(current: number, previous: number): Growth {
    if (previous <= 0 && current <= 0) return { pct: null, direction: 'none' }
    if (previous <= 0) return { pct: null, direction: 'new' }
    const pct = Math.round(((current - previous) / previous) * 100)
    return { pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

export function buildInsights(
    orders: InsightOrder[],
    afa: InsightAfa[],
    days: number,
    now: Date = new Date(),
): DashboardInsights {
    const today0 = startOfDay(now).getTime()
    const currentStart = today0 - (days - 1) * DAY_MS
    const previousStart = currentStart - days * DAY_MS

    const series: DayPoint[] = []
    const byKey = new Map<string, DayPoint>()
    for (let i = 0; i < days; i++) {
        const d = new Date(currentStart + i * DAY_MS)
        const point: DayPoint = {
            key: dayKey(d),
            label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
            orders: 0,
            spend: 0,
        }
        series.push(point)
        byKey.set(point.key, point)
    }

    const current = emptyTotals()
    const previous = emptyTotals()
    const networkCounts = new Map<string, number>()
    const today = { orders: 0, spend: 0 }
    const todayKey = dayKey(now)

    const add = (createdAt: string | null, status: string | null, amount: number, network: string | null) => {
        if (!createdAt) return
        const when = new Date(createdAt)
        const t = when.getTime()
        if (Number.isNaN(t) || t < previousStart) return
        const bucket = t >= currentStart ? current : previous
        const s = status ?? ''
        bucket.orders++
        if (COUNTS_AS_SPEND.has(s)) bucket.spend += amount
        if (s === 'completed') bucket.completed++
        else if (IN_PROGRESS.has(s)) bucket.inProgress++
        else if (FAILED.has(s)) bucket.failed++

        if (bucket !== current) return
        const point = byKey.get(dayKey(when))
        if (point) {
            point.orders++
            if (COUNTS_AS_SPEND.has(s)) point.spend += amount
        }
        if (dayKey(when) === todayKey) {
            today.orders++
            if (COUNTS_AS_SPEND.has(s)) today.spend += amount
        }
        if (network) {
            const name = network.trim().toUpperCase()
            networkCounts.set(name, (networkCounts.get(name) ?? 0) + 1)
        }
    }

    for (const o of orders) add(o.created_at, o.status, o.price ?? 0, o.network)
    for (const a of afa) add(a.created_at, a.status, a.payment_amount ?? 0, 'AFA')

    const networkTotal = Array.from(networkCounts.values()).reduce((a, b) => a + b, 0)
    const networks = Array.from(networkCounts.entries())
        .map(([network, count]) => ({ network, orders: count, share: networkTotal ? count / networkTotal : 0 }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 4)

    const finished = current.completed + current.failed
    const best = series.reduce<DayPoint | null>((top, p) => (p.orders > 0 && (!top || p.orders > top.orders) ? p : top), null)

    return {
        days,
        series,
        current,
        previous,
        spendGrowth: computeGrowth(current.spend, previous.spend),
        orderGrowth: computeGrowth(current.orders, previous.orders),
        successRate: finished > 0 ? Math.round((current.completed / finished) * 100) : null,
        networks,
        bestDay: best,
        today,
    }
}
