'use client'

import { CheckCircle2, ClipboardCopy, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import { downloadResultsCheckerVouchers } from '@/lib/results-checker-utils'
import { voucherText, type Voucher } from './meta'
import { VoucherCards } from './VoucherCards'
import { HowToUse } from './HowToUse'

export interface Receipt {
    referenceCode: string
    typeName: string
    quantity: number
    total: number
    vouchers: Voucher[]
    duplicate: boolean
}

interface ReceiptDialogProps {
    receipt: Receipt | null
    ownPhone?: string
    ownEmail?: string
    onClose: () => void
    onViewAll: () => void
}

/** Shown the moment a purchase goes through: the vouchers, how to use them, and ways to keep them. */
export function ReceiptDialog({ receipt, ownPhone, ownEmail, onClose, onViewAll }: ReceiptDialogProps) {
    const copyAll = async () => {
        if (!receipt) return
        try {
            await navigator.clipboard.writeText(voucherText(receipt.vouchers))
            toast.success('All vouchers copied')
        } catch {
            toast.error('Could not copy')
        }
    }

    return (
        <Dialog open={!!receipt} onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-xl max-sm:!fixed max-sm:!bottom-0 max-sm:!left-0 max-sm:!top-auto max-sm:max-w-full max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:rounded-b-none"
            >
                <DialogDescription className="sr-only">Your results checker vouchers</DialogDescription>
                <DialogClose className="well absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>

                {receipt && (
                    <div className="space-y-5 px-6 pb-7 pt-8">
                        <div className="flex items-center gap-4 pr-8">
                            <span className="clay-gold flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"><CheckCircle2 className="h-7 w-7" /></span>
                            <div className="min-w-0">
                                <DialogTitle className="font-display text-xl font-semibold">{receipt.duplicate ? 'You already bought this' : 'You’re all set'}</DialogTitle>
                                <p className="text-sm text-muted-foreground">
                                    {receipt.quantity} {receipt.quantity === 1 ? 'voucher' : 'vouchers'} · {formatCurrency(receipt.total)}
                                </p>
                            </div>
                        </div>

                        <VoucherCards vouchers={receipt.vouchers} typeName={receipt.typeName} startRevealed />
                        <HowToUse typeName={receipt.typeName} />

                        <p className="break-all text-center font-mono text-[11px] text-muted-foreground">Order {receipt.referenceCode} · saved in My vouchers</p>

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="gap-2" onClick={copyAll}><ClipboardCopy className="h-4 w-4" /> Copy all</Button>
                            <Button variant="outline" className="gap-2" onClick={() => downloadResultsCheckerVouchers({ type_name: receipt.typeName, reference_code: receipt.referenceCode }, receipt.vouchers, ownPhone, ownEmail)}>
                                <Download className="h-4 w-4" /> Download
                            </Button>
                            <Button variant="ghost" onClick={() => { onClose(); onViewAll() }}>My vouchers</Button>
                            <Button onClick={onClose}>Done</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}