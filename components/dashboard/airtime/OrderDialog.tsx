'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, Loader2, X } from 'lucide-react'
import { NetworkIcon } from '@/components/network-icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { formatCurrency, generateReferenceCode } from '@/lib/utils'
import type { AirtimeQuote } from '@/lib/airtime-pricing'
import type { BundlePreference, MashupBundle } from '@/lib/mashup-bundle'
import type { AirtimeNetwork, PurchaseMode } from './meta'
import { MashupEstimate } from './MashupOptions'

export interface OrderDraft {
    network: AirtimeNetwork
    phone: string
    mode: PurchaseMode
    amount: number
    feeOnTop: boolean
    bundlePreference: BundlePreference
    quote: AirtimeQuote
    bundle: MashupBundle | null
}

interface PlacedOrder {
    referenceCode: string
    newBalance: number | null
    duplicate: boolean
}

interface OrderDialogProps {
    draft: OrderDraft | null
    onClose: () => void
    /** An order went through; `newBalance` is the wallet after it (null if unknown). */
    onPlaced: (newBalance: number | null) => void
    onViewHistory: () => void
}

/** Confirm and pay, then show the receipt. A bottom sheet on phones, a dialog on larger screens. */
export function OrderDialog({ draft, onClose, onPlaced, onViewHistory }: OrderDialogProps) {
    const [paying, setPaying] = useState(false)
    const [placed, setPlaced] = useState<PlacedOrder | null>(null)
    // One reference per attempt, sent with every retry: a double tap or a retry after a dropped
    // connection can never buy twice.
    const [reference, setReference] = useState('')
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!draft) return
        setPlaced(null)
        setPaying(false)
        setCopied(false)
        setReference(generateReferenceCode())
    }, [draft])

    const pay = async () => {
        if (!draft || paying) return
        setPaying(true)
        try {
            const res = await fetch('/api/airtime/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    beneficiaryPhone: draft.phone,
                    network: draft.network,
                    amount: draft.amount,
                    useExactAmount: draft.feeOnTop,
                    type: draft.mode,
                    bundle_preference: draft.mode === 'mashup' ? draft.bundlePreference : undefined,
                    referenceCode: reference,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not place the order')

            const o = data.order ?? {}
            const newBalance = typeof o.new_balance === 'number' ? o.new_balance : null
            setPlaced({ referenceCode: o.reference_code ?? reference, newBalance, duplicate: !!data.isDuplicate })
            onPlaced(newBalance)
        } catch (e: any) {
            toast.error(e.message || 'Could not place the order')
        } finally {
            setPaying(false)
        }
    }

    const copyReference = async () => {
        if (!placed) return
        try {
            await navigator.clipboard.writeText(placed.referenceCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Could not copy')
        }
    }

    const isMashup = draft?.mode === 'mashup'
    const product = isMashup ? 'Mashup bundle' : 'airtime'

    return (
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !paying) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className="gap-0 overflow-hidden p-0 sm:max-w-md max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
                onInteractOutside={e => { if (paying) e.preventDefault() }}
            >
                <DialogDescription className="sr-only">Review and pay for your {product}</DialogDescription>
                <DialogClose
                    disabled={paying}
                    className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>

                {draft && (
                    <div className="space-y-5 px-6 pb-7 pt-8">
                        {placed ? (
                            <div className="flex flex-col items-center gap-2 text-center">
                                <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full">
                                    <CheckCircle2 className="h-8 w-8" />
                                </span>
                                <DialogTitle className="font-display text-xl font-semibold">
                                    {placed.duplicate ? 'Order already placed' : 'Order placed'}
                                </DialogTitle>
                                <p className="text-sm text-muted-foreground">
                                    {isMashup ? 'Your Mashup bundle is queued.' : 'Your airtime is queued.'} It will show as Pending until our team delivers it.
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 pr-8">
                                <span className="well flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl">
                                    <NetworkIcon network={draft.network} size={32} />
                                </span>
                                <div className="min-w-0">
                                    <DialogTitle className="font-display text-xl font-semibold">Confirm {isMashup ? 'Mashup bundle' : 'airtime'}</DialogTitle>
                                    <p className="text-sm text-muted-foreground">Check the details before you pay.</p>
                                </div>
                            </div>
                        )}

                        {isMashup && draft.bundle && <MashupEstimate bundle={draft.bundle} />}

                        <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                            {([
                                ['Network', draft.network],
                                ['Recipient', draft.phone],
                                ...(isMashup ? [] : [['Airtime', formatCurrency(draft.quote.airtimeAmount)]]),
                                ['Service fee', formatCurrency(draft.quote.feeAmount)],
                                ...(placed?.newBalance != null ? [['Wallet now', formatCurrency(placed.newBalance)]] : []),
                            ] as string[][]).map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">{label}</dt>
                                    <dd className="font-semibold tabular-nums">{value}</dd>
                                </div>
                            ))}
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                <dt className="font-medium">{placed ? 'Paid' : 'Total to pay'}</dt>
                                <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(draft.quote.totalPaid)}</dd>
                            </div>
                        </dl>

                        {placed ? (
                            <>
                                <button
                                    type="button"
                                    onClick={copyReference}
                                    className="neu-raised-sm neu-press flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-xs text-muted-foreground">Reference</span>
                                        <span className="block truncate font-mono text-sm">{placed.referenceCode}</span>
                                    </span>
                                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                        <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
                                    </span>
                                </button>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={onClose}>Buy more</Button>
                                    <Button className="flex-1" onClick={() => { onClose(); onViewHistory() }}>View history</Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={onClose} disabled={paying}>Cancel</Button>
                                <Button className="flex-1" onClick={pay} disabled={paying}>
                                    {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Pay ${formatCurrency(draft.quote.totalPaid)}`}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
