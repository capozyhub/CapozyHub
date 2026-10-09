'use client'

import { useState } from 'react'
import { AlertCircle, ChevronDown, Download, Flag, Loader2, RefreshCw } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { cn, formatCurrency } from '@/lib/utils'
import { downloadResultsCheckerVouchers } from '@/lib/results-checker-utils'
import type { RCOrder, Voucher } from './meta'
import { VoucherCards } from './VoucherCards'

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
    completed: 'completed',
    pending: 'pending',
    failed: 'failed',
    refunded: 'secondary',
}

interface OrderRowProps {
    order: RCOrder
    ownPhone?: string
    ownEmail?: string
    onReport: (order: RCOrder) => void
}

/** One past order. Opening it loads its vouchers on demand, so PINs are not fetched until asked for. */
export function OrderRow({ order, ownPhone, ownEmail, onReport }: OrderRowProps) {
    const [open, setOpen] = useState(false)
    const [vouchers, setVouchers] = useState<Voucher[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [resending, setResending] = useState(false)

    const complaint = order.results_checker_complaints?.[0]
    const hasVouchers = order.status === 'completed' && !!order.inventory_ids?.length

    const toggle = async () => {
        const next = !open
        setOpen(next)
        if (!next || !hasVouchers || vouchers || loading) return
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/results-checker/order-vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not load your vouchers')
            const list: Voucher[] = Array.isArray(data.vouchers) ? data.vouchers : []
            if (list.length === 0) throw new Error('This order is complete, but its vouchers could not be loaded.')
            setVouchers(list)
        } catch (e: any) {
            setError(e.message || 'Could not load your vouchers')
        } finally {
            setLoading(false)
        }
    }

    const resend = async () => {
        setResending(true)
        try {
            const res = await fetch('/api/results-checker/resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not resend')
            toast.success('Vouchers resent')
        } catch (e: any) {
            toast.error(e.message || 'Could not resend')
        } finally {
            setResending(false)
        }
    }

    return (
        <li className="surface overflow-hidden rounded-2xl">
            <button
                type="button"
                aria-expanded={open}
                onClick={toggle}
                className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{order.type_name}</span>
                        <Badge variant={STATUS_VARIANT[order.status] ?? 'secondary'} className="capitalize">{order.status}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{order.reference_code} · {new Date(order.created_at).toLocaleDateString()}</span>
                </span>
                <span className="flex-shrink-0 text-right">
                    <span className="block font-display text-base font-bold tabular-nums">{formatCurrency(order.total_paid)}</span>
                    <span className="block text-xs text-muted-foreground">{order.quantity} {order.quantity === 1 ? 'voucher' : 'vouchers'}</span>
                </span>
                <ChevronDown className={cn('h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
            </button>

            {open && (
                <div className="space-y-3 border-t border-border/60 p-4">
                    {order.status === 'pending' && <p className="text-sm text-muted-foreground">This order is still being processed.</p>}
                    {order.status === 'failed' && <p className="text-sm text-muted-foreground">This order did not go through.</p>}
                    {order.status === 'refunded' && <p className="text-sm text-muted-foreground">This order was refunded.</p>}

                    {hasVouchers && (
                        loading ? (
                            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : error ? (
                            <p role="alert" className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}</p>
                        ) : vouchers && (
                            <>
                                <VoucherCards vouchers={vouchers} />
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadResultsCheckerVouchers(order, vouchers, ownPhone, ownEmail)}>
                                        <Download className="h-4 w-4" /> Download
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={resend} disabled={resending}>
                                        {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Resend
                                    </Button>
                                    {complaint ? (
                                        <span className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground"><Flag className="h-3.5 w-3.5" /> {complaint.status === 'resolved' ? 'Report resolved' : 'Report under review'}</span>
                                    ) : (
                                        <Button variant="outline" size="sm" className="gap-2" onClick={() => onReport(order)}><Flag className="h-4 w-4" /> Report a problem</Button>
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