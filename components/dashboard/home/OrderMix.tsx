import { cn } from '@/lib/utils'
import type { DashboardInsights } from '@/lib/dashboard-insights'

const SEGMENTS = [
    { key: 'completed', label: 'Delivered', color: '#16A34A' },
    { key: 'inProgress', label: 'In progress', color: '#F6C30F' },
    { key: 'failed', label: 'Failed or refunded', color: '#E5383B' },
] as const

const NETWORK_COLORS: Record<string, string> = {
    MTN: '#FFCC00',
    TELECEL: '#E60000',
    AT: '#0057B8',
    AIRTELTIGO: '#0057B8',
    AFA: '#8B5CF6',
}

function networkName(n: string): string {
    if (n === 'MTN' || n === 'AFA') return n
    if (n === 'AT' || n === 'AIRTELTIGO') return 'AirtelTigo'
    return n.charAt(0) + n.slice(1).toLowerCase()
}

export function OrderMix({ insights }: { insights: DashboardInsights }) {
    const { current, networks, days } = insights
    const total = current.completed + current.inProgress + current.failed
    const R = 42
    const C = 2 * Math.PI * R

    // One arc per status, laid end to end around the ring.
    let offset = 0
    const arcs = SEGMENTS.map(s => {
        const value = current[s.key]
        const len = total ? (value / total) * C : 0
        const arc = { ...s, value, len, offset }
        offset += len
        return arc
    })

    return (
        <section aria-label="Order mix" className="neu-raised-sm rounded-3xl p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold">Where orders stand</h2>
            <p className="text-xs text-muted-foreground">Last {days} days</p>

            <div className="mt-4 flex items-center gap-5">
                <div className="relative h-28 w-28 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${total} orders by status`}>
                        <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="11" />
                        {arcs.map(a => a.len > 0 && (
                            <circle
                                key={a.key}
                                cx="50"
                                cy="50"
                                r={R}
                                fill="none"
                                stroke={a.color}
                                strokeWidth="11"
                                strokeLinecap="butt"
                                strokeDasharray={`${Math.max(a.len - 1.5, 0.5)} ${C}`}
                                strokeDashoffset={-a.offset}
                            />
                        ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display text-2xl font-bold leading-none">{total}</span>
                        <span className="mt-0.5 text-[11px] text-muted-foreground">orders</span>
                    </div>
                </div>

                <ul className="min-w-0 flex-1 space-y-2">
                    {arcs.map(a => (
                        <li key={a.key} className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                                <span className="truncate text-muted-foreground">{a.label}</span>
                            </span>
                            <span className="font-semibold tabular-nums">{a.value}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mt-6">
                <h3 className="text-sm font-semibold">By network</h3>
                {networks.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Nothing to show yet.</p>
                ) : (
                    <ul className="mt-3 space-y-3">
                        {networks.map(n => (
                            <li key={n.network}>
                                <div className="flex items-baseline justify-between text-sm">
                                    <span className="font-medium">{networkName(n.network)}</span>
                                    <span className="tabular-nums text-muted-foreground">{n.orders} · {Math.round(n.share * 100)}%</span>
                                </div>
                                <div className="neu-inset mt-1.5 h-2 overflow-hidden rounded-full">
                                    <div
                                        className={cn('h-full rounded-full')}
                                        style={{ width: `${Math.max(4, n.share * 100)}%`, backgroundColor: NETWORK_COLORS[n.network] ?? '#8E8E8E' }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}
