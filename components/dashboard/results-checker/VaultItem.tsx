'use client'

import { useState } from 'react'
import { AlertCircle, ChevronDown, Download, Flag, Loader2, Send } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { cn, formatCurrency } from '@/lib/utils'
import { downloadResultsCheckerVouchers } from '@/lib/results-checker-utils'
import { examLabel, type RCOrder, type Voucher } from './meta'
import { VoucherCards } from './VoucherCards'
import { HowToUse } from './HowToUse'

const STATUS: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    completed: { variant: 'completed', label: 'Ready' },
    pending: { variant: 'pending', label: 'Processing' },
    failed: { variant: 'failed', label: 'Failed' },
    refunded: { variant: 'secondary', label: 'Refunded' },
}

interface VaultItemProps {
    order: RCOrder
    ownPhone?: string
    ownEmail?: string
    onReport: (order: RCOrder) => void
}

/** One past order as a ticket. Its PINs are only fetched when you open it. */
export function VaultItem({ order, ownPhone, ownEmail, onReport }: VaultItemProps) {
    const [open, setOpen] = useState(false)
    const [vouchers, setVouchers] = useState<Voucher[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [sending, setSending] = useState(false)

    const status = STATUS[order.status] ?? { variant: 'secondary' as const, label: order.status }
    const complaint = order.results_checker_complaints?.[0]
    const hasVouchers = order.status === 'completed' && !!order.inventory_ids?.length

    const load = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/results-checker/order-vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'We could not load these vouchers.')
            const list: Voucher[] = Array.isArray(data.vouchers) ? data.vouchers : []
            if (list.length === 0) throw new Error('This order is complete, but its vouchers did not load. Try again, or report a problem.')
            setVouchers(list)
        } catch (e: any) {
            setError(e.message || 'We could not load these vouchers.')
        } finally {
            setLoading(false)
        }
    }

    const toggle = () => {
        const next = !open
        setOpen(next)
        if (next && hasVouchers && !vouchers && !loading) load()
    }

    const resend = async () => {
        setSending(true)
        try {
            const res = await fetch('/api/results-checker/resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not send them again.')
            toast.success('Sent again')
        } catch (e: any) {
            toast.error(e.message || 'Could not send them again.')
        } finally {
            setSending(false)
        }
    }

    return (
        <li className="surface overflow-hidden rounded-2xl">
            <button
                type="button"
                aria-expanded={open}
                onClick={toggle}
                className="flex w-full items-stretch text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
                <span className="flex w-20 flex-shrink-0 flex-col items-center justify-center gap-0.5 border-r border-dashed border-border bg-foreground/[0.04] px-2 py-4 sm:w-24">
                    <span className="font-display text-base font-bold leading-none tracking-tight">{examLabel(order.type_name)}</span>
                    <span className="text-[11px] text-muted-foreground">×{order.quantity}</span>
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-3 p-4">
                    <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </span>
                        <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{order.reference_code}</span>
                    </span>
                    <span className="flex-shrink-0 font-display text-base font-bold tabular-nums">{formatCurrency(order.total_paid)}</span>
                    <ChevronDown className={cn('h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
                </span>
            </button>

            {open && (
                <div className="space-y-4 border-t border-border/60 p-4">
                    {order.status === 'pending' && <p className="text-sm text-muted-foreground">We’re still working on this order. It will show up here when it’s ready.</p>}
                    {order.status === 'failed' && <p className="text-sm text-muted-foreground">This order didn’t go through. If you were charged, report a problem and we’ll sort it out.</p>}
                    {order.status === 'refunded' && <p className="text-sm text-muted-foreground">This order was refunded to your wallet.</p>}

                    {hasVouchers && (
                        loading ? (
                            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : error ? (
                            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-amber-700 dark:text-amber-400">
                                <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}</span>
                                <Button variant="outline" size="sm" onClick={load}>Try again</Button>
                            </div>
                        ) : vouchers && (
                            <>
                                <VoucherCards vouchers={vouchers} typeName={order.type_name} />
                                <HowToUse typeName={order.type_name} />
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadResultsCheckerVouchers(order, vouchers, ownPhone, ownEmail)}><Download className="h-4 w-4" /> Download</Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={resend} disabled={sending}>
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send again
                                    </Button>
                                    {complaint ? (
                                        <span className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground"><Flag className="h-3.5 w-3.5" /> {complaint.status === 'resolved' ? 'Problem resolved' : 'We’re looking into it'}</span>
                                    ) : (
                                        <Button variant="ghost" size="sm" className="gap-2" onClick={() => onReport(order)}><Flag className="h-4 w-4" /> Something wrong?</Button>
                                    )}
                                </div>
                            </>
                        )
                    )}
                </div>
            )}
        </li>
    )
}