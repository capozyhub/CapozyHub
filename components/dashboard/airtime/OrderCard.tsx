'use client'

import { Copy, Zap } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { NetworkIcon } from '@/components/network-icon'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import type { AirtimeOrder } from './meta'

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
    pending: 'pending',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed',
    refunded: 'secondary',
}

async function copy(text: string, done: string) {
    try {
        await navigator.clipboard.writeText(text)
        toast.success(done)
    } catch {
        toast.error('Could not copy')
    }
}

export function OrderCard({ order }: { order: AirtimeOrder }) {
    const mashup = order.type === 'mashup'
    return (
        <li className="surface rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="well flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl">
                        <NetworkIcon network={order.network} size={28} />
                    </span>
                    <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-semibold">
                            {order.network}
                            {mashup && <span className="flex items-center gap-0.5 rounded-full bg-primary/25 px-1.5 py-0.5 text-[10px] font-semibold text-foreground"><Zap className="h-2.5 w-2.5" /> Mashup</span>}
                        </p>
                        <button
                            type="button"
                            onClick={() => copy(order.beneficiary_phone, 'Number copied')}
                            aria-label={`Copy ${order.beneficiary_phone}`}
                            className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                        >
                            {order.beneficiary_phone} <Copy className="h-3 w-3" />
                        </button>
                    </div>
                </div>
                <div className="flex-shrink-0 text-right">
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'} className="capitalize">{order.status}</Badge>
                    <p className="mt-1 font-display text-base font-bold tabular-nums">{formatCurrency(order.total_paid)}</p>
                </div>
            </div>

            <dl className="well mt-3 grid grid-cols-3 gap-2 rounded-xl p-2.5 text-xs">
                <div className="min-w-0"><dt className="text-muted-foreground">{mashup ? 'Bundle' : 'Airtime'}</dt><dd className="truncate font-semibold tabular-nums">{formatCurrency(order.airtime_amount)}</dd></div>
                <div className="min-w-0 text-center"><dt className="text-muted-foreground">Fee</dt><dd className="truncate font-semibold tabular-nums">{formatCurrency(order.fee_amount)}</dd></div>
                <div className="min-w-0 text-right"><dt className="text-muted-foreground">When</dt><dd className="truncate font-semibold">{format(parseISO(order.created_at), 'MMM d, h:mm a')}</dd></div>
            </dl>

            <button
                type="button"
                onClick={() => copy(order.reference_code, 'Reference copied')}
                aria-label={`Copy reference ${order.reference_code}`}
                className="mt-3 flex w-full items-center gap-1.5 truncate rounded font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <Copy className="h-3 w-3 shrink-0" /> <span className="truncate">{order.reference_code}</span>
            </button>
        </li>
    )
}
