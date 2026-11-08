'use client'

import { useState } from 'react'
import { Check, Copy, Zap } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { NetworkIcon } from '@/components/network-icon'
import { toast } from '@/lib/toast'
import { cn, formatCurrency } from '@/lib/utils'
import type { AirtimeOrder } from './meta'

const STATUS: Record<string, { label: string; dot: string }> = {
    pending: { label: 'Pending', dot: 'bg-amber-500' },
    processing: { label: 'On its way', dot: 'bg-sky-500' },
    completed: { label: 'Delivered', dot: 'bg-emerald-500' },
    failed: { label: 'Failed', dot: 'bg-red-500' },
    refunded: { label: 'Refunded', dot: 'bg-muted-foreground' },
}

/** One receipt line: who, what, when and where it stands. Tap to copy the reference. */
export function OrderCard({ order }: { order: AirtimeOrder }) {
    const [copied, setCopied] = useState(false)
    const mashup = order.type === 'mashup'
    const status = STATUS[order.status] ?? { label: order.status, dot: 'bg-muted-foreground' }

    const copyReference = async () => {
        try {
            await navigator.clipboard.writeText(order.reference_code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
        } catch {
            toast.error('Could not copy')
        }
    }

    return (
        <li className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
            <span className="neu-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <NetworkIcon network={order.network} size={28} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                    <span className="font-mono tracking-wide">{order.beneficiary_phone}</span>
                    {mashup && <span className="clay-gold flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"><Zap className="h-2.5 w-2.5" /> Mashup</span>}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', status.dot)} aria-hidden />
                        {status.label}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{format(parseISO(order.created_at), 'h:mm a')}</span>
                    <span aria-hidden>·</span>
                    <button
                        type="button"
                        onClick={copyReference}
                        aria-label={`Copy reference ${order.reference_code}`}
                        className="flex items-center gap-1 rounded font-mono hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
                    >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? 'Copied' : order.reference_code.slice(-8)}
                    </button>
                </p>
            </div>
            <div className="shrink-0 text-right">
                <p className="font-display text-base font-bold tabular-nums">{formatCurrency(order.total_paid)}</p>
                <p className="text-[11px] text-muted-foreground">{formatCurrency(order.airtime_amount)} {mashup ? 'bundle' : 'sent'}</p>
            </div>
        </li>
    )
}
