import Link from 'next/link'
import { ArrowRight, Inbox } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export interface RecentOrder {
    id: string
    reference_code: string
    network: string
    size: string
    price: number
    status: string | null
    created_at: string | null
    phone_number: string
}

const STATUS: Record<string, { label: string; className: string }> = {
    completed: { label: 'Delivered', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    pending: { label: 'Pending', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500' },
    processing: { label: 'Processing', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500' },
    queued: { label: 'Queued', className: 'bg-brand-500/15 text-brand-700 dark:text-brand-500' },
    failed: { label: 'Failed', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
    refunded: { label: 'Refunded', className: 'bg-foreground/10 text-muted-foreground' },
}

function when(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    const sameDay = d.toDateString() === new Date().toDateString()
    return sameDay
        ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function RecentOrders({ orders }: { orders: RecentOrder[] }) {
    return (
        <section aria-label="Recent orders" className="neu-raised-sm rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Recent orders</h2>
                <Link href="/dashboard/my-orders" className="inline-flex items-center gap-1 rounded text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-brand-500">
                    See all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>

            {orders.length === 0 ? (
                <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl py-8 text-center">
                    <span className="neu-inset flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground"><Inbox className="h-5 w-5" /></span>
                    <p className="text-sm font-medium">No orders yet</p>
                    <Link href="/dashboard/data-packages" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-500">Buy your first bundle</Link>
                </div>
            ) : (
                <ul className="mt-3 divide-y divide-border">
                    {orders.map(o => {
                        const s = STATUS[o.status ?? ''] ?? { label: o.status ?? 'Unknown', className: 'bg-foreground/10 text-muted-foreground' }
                        return (
                            <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{o.network} {o.size}</p>
                                    <p className="truncate text-xs text-muted-foreground">{o.phone_number} · {when(o.created_at)}</p>
                                </div>
                                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(o.price)}</span>
                                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', s.className)}>{s.label}</span>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}
