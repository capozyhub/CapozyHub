'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { formatCurrency, generateReferenceCode } from '@/lib/utils'
import { downloadResultsCheckerVouchers } from '@/lib/results-checker-utils'
import type { Voucher } from './meta'
import { VoucherCards } from './VoucherCards'

export interface PurchaseDraft {
    typeId: string
    typeName: string
    quantity: number
    unitPrice: number
    total: number
    recipientPhone: string
    recipientEmail: string
}

interface Placed {
    referenceCode: string
    vouchers: Voucher[]
    duplicate: boolean
}

interface PurchaseDialogProps {
    draft: PurchaseDraft | null
    /** The member's own contact details, for the downloaded voucher file. */
    ownPhone?: string
    ownEmail?: string
    onClose: () => void
    /** A purchase went through; `newBalance` is the wallet after it (null if unknown). */
    onPurchased: (newBalance: number | null) => void
}

/** Confirm and pay, then show the vouchers. A bottom sheet on phones, a dialog on larger screens. */
export function PurchaseDialog({ draft, ownPhone, ownEmail, onClose, onPurchased }: PurchaseDialogProps) {
    const [paying, setPaying] = useState(false)
    const [placed, setPlaced] = useState<Placed | null>(null)
    // One reference per attempt, sent with every retry: a double tap or a retry after a dropped
    // connection can never buy twice.
    const [reference, setReference] = useState('')

    useEffect(() => {
        if (!draft) return
        setPlaced(null)
        setPaying(false)
        setReference(`RC-${generateReferenceCode()}`)
    }, [draft])

    const pay = async () => {
        if (!draft || paying) return
        setPaying(true)
        try {
            const res = await fetch('/api/results-checker/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    typeId: draft.typeId,
                    quantity: draft.quantity,
                    recipientPhone: draft.recipientPhone || undefined,
                    recipientEmail: draft.recipientEmail || undefined,
                    referenceCode: reference,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Purchase failed')

            setPlaced({ referenceCode: data.order?.reference_code ?? reference, vouchers: data.vouchers ?? [], duplicate: !!data.isDuplicate })
            onPurchased(typeof data.newBalance === 'number' ? data.newBalance : null)
        } catch (e: any) {
            toast.error(e.message || 'Purchase failed')
        } finally {
            setPaying(false)
        }
    }

    const download = () => {
        if (!draft || !placed) return
        downloadResultsCheckerVouchers({ type_name: draft.typeName, reference_code: placed.referenceCode }, placed.vouchers, ownPhone, ownEmail)
    }

    return (
        <Dialog open={!!draft} onOpenChange={open => { if (!open && !paying) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
                onInteractOutside={e => { if (paying) e.preventDefault() }}
            >
                <DialogDescription className="sr-only">Review and pay for your results checker vouchers</DialogDescription>
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
                                <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full"><CheckCircle2 className="h-8 w-8" /></span>
                                <DialogTitle className="font-display text-xl font-semibold">{placed.duplicate ? 'Order already placed' : 'Your vouchers are ready'}</DialogTitle>
                                <p className="break-all font-mono text-xs text-muted-foreground">{placed.referenceCode}</p>
                            </div>
                        ) : (
                            <div className="pr-8">
                                <DialogTitle className="font-display text-xl font-semibold">Confirm purchase</DialogTitle>
                                <p className="text-sm text-muted-foreground">Vouchers appear here the moment you pay.</p>
                            </div>
                        )}

                        {placed ? (
                            <>
                                <VoucherCards vouchers={placed.vouchers} startRevealed />
                                <p className="text-xs text-muted-foreground">Keep these safe. You can also find them under Order history.</p>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1 gap-2" onClick={download} disabled={placed.vouchers.length === 0}><Download className="h-4 w-4" /> Download</Button>
                                    <Button className="flex-1" onClick={onClose}>Done</Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                                    {([
                                        ['Exam', draft.typeName],
                                        ['Quantity', `${draft.quantity} ${draft.quantity === 1 ? 'voucher' : 'vouchers'}`],
                                        ['Price each', formatCurrency(draft.unitPrice)],
                                        ...(draft.recipientPhone ? [['Send to phone', draft.recipientPhone]] : []),
                                        ...(draft.recipientEmail ? [['Send to email', draft.recipientEmail]] : []),
                                    ] as string[][]).map(([label, value]) => (
                                        <div key={label} className="flex items-center justify-between gap-3">
                                            <dt className="text-muted-foreground">{label}</dt>
                                            <dd className="min-w-0 truncate text-right font-semibold">{value}</dd>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                        <dt className="font-medium">Total to pay</dt>
                                        <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(draft.total)}</dd>
                                    </div>
                                </dl>
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={paying}>Cancel</Button>
                                    <Button className="flex-1" onClick={pay} disabled={paying}>
                                        {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : `Pay ${formatCurrency(draft.total)}`}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}