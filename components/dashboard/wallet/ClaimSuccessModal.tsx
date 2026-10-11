'use client'

import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import type { ClaimSuccessData } from './meta'

interface ClaimSuccessModalProps {
    data: ClaimSuccessData | null
    onClose: () => void
}

export function ClaimSuccessModal({ data, onClose }: ClaimSuccessModalProps) {
    return (
        <Dialog open={!!data} onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent hideCloseButton aria-describedby={undefined} className="gap-0 overflow-hidden p-0 sm:max-w-sm">
                {data && (
                    <div className="space-y-5 px-6 pb-7 pt-8">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <span className="clay-gold flex h-16 w-16 items-center justify-center rounded-full">
                                <CheckCircle2 className="h-8 w-8" />
                            </span>
                            <DialogTitle className="font-display text-xl font-semibold">Claim successful</DialogTitle>
                            <p className="text-sm text-muted-foreground">Your wallet was credited instantly.</p>
                        </div>

                        <dl className="well space-y-2.5 rounded-2xl p-4 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Transaction</dt>
                                <dd className="font-mono font-semibold">#{data.transaction_id}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Amount sent</dt>
                                <dd className="font-semibold tabular-nums">{formatCurrency(data.amount)}</dd>
                            </div>
                            {data.fee_amount > 0 && (
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">Fee ({data.fee_percent}%)</dt>
                                    <dd className="font-semibold tabular-nums text-red-500">-{formatCurrency(data.fee_amount)}</dd>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                                <dt className="font-medium">Credited</dt>
                                <dd className="font-display text-lg font-bold tabular-nums">{formatCurrency(data.net_amount)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">New balance</dt>
                                <dd className="font-semibold tabular-nums">{formatCurrency(data.new_balance)}</dd>
                            </div>
                        </dl>

                        <Button className="w-full" onClick={onClose}>Done</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
